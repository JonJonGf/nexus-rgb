using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// Runs inside the existing interactive tray, never in LocalService/session 0.
// Only compact band energies and the executable basename cross loopback HTTP.
// No microphone, file recording, title/key capture or shell execution.
internal sealed class ExperiencesBridge : IDisposable {
    private readonly CookieContainer cookies = new CookieContainer();
    private readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 16384 };
    private readonly object gate = new object();
    private bool checking, sending, disposed, contextEnabled;
    private IntPtr hook = IntPtr.Zero;
    private WinEvent callback;
    private LoopbackBands audio;
    private string application = "", capture = "stopped";
    private int audioAttempts;
    private DateTime retryAt = DateTime.MinValue;
    private volatile string panel;
    // Registry/port faults must not prevent the tray (and its repair menu) opening.
    internal ExperiencesBridge() { }
    private delegate void WinEvent(IntPtr hook, uint evt, IntPtr window, int obj, int child, uint thread, uint time);
    [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min,uint max,IntPtr module,WinEvent callback,uint process,uint thread,uint flags);
    [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);

    private string Request(string route, object body) {
        string endpoint = panel;
        var request = (HttpWebRequest)WebRequest.Create(endpoint + route);
        request.Proxy = null; request.Timeout = 1500; request.ReadWriteTimeout = 1500; request.AllowAutoRedirect = false; request.CookieContainer = cookies;
        if (body != null) {
            request.Method = "POST"; request.ContentType = "application/json";
            request.Headers["Origin"] = endpoint.TrimEnd('/'); request.Headers["X-Nexus-Client"] = "web";
            byte[] bytes; lock (json) bytes = System.Text.Encoding.UTF8.GetBytes(json.Serialize(body));
            request.ContentLength = bytes.Length; using (var stream = request.GetRequestStream()) stream.Write(bytes,0,bytes.Length);
        }
        using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) {
            char[] buffer = new char[16385]; int length = 0, n;
            while(length < buffer.Length && (n = reader.Read(buffer,length,buffer.Length-length)) > 0) length += n;
            if(length > 16384) throw new IOException("Invalid local response"); return new string(buffer,0,length);
        }
    }
    internal async void Tick() {
        if(checking || disposed)return; checking = true;
        try {
            panel = Program.Panel;
            var config = await Task.Run(() => {
                try { return Request("api/experiences/agent",null); }
                catch(WebException error) { if(error.Response != null) error.Response.Close(); Request("api/session/local",new {}); return Request("api/experiences/agent",null); }
            });
            if(disposed)return;
            Dictionary<string,object> data; lock(json)data = json.Deserialize<Dictionary<string,object>>(config);
            bool wantContext = data.ContainsKey("context") && data["context"] is bool && (bool)data["context"];
            bool wantAudio = data.ContainsKey("audio") && data["audio"] is bool && (bool)data["audio"];
            if(wantContext != contextEnabled) {
                contextEnabled = wantContext;
                if(hook != IntPtr.Zero) { UnhookWinEvent(hook); hook = IntPtr.Zero; }
                if(wantContext) { callback = (h,e,w,o,c,t,ms) => Foreground(); hook = SetWinEventHook(3,3,IntPtr.Zero,callback,0,0,2); Foreground(); }
                else application = "";
            }
            if(!wantAudio) { if(audio != null)audio.Dispose(); audio = null; capture = "stopped";audioAttempts = 0; }
            else if((audio == null || !audio.Alive) && DateTime.UtcNow >= retryAt && audioAttempts < 3) {
                if(audio != null)audio.Dispose();audioAttempts++;retryAt=DateTime.UtcNow.AddSeconds(30);
                audio = new LoopbackBands((bands,state) => { capture=state;Send(bands); });audio.Start();
            }
            if(contextEnabled)Foreground(); else if(wantAudio)Send(null);
        } catch { // Fail closed on service loss: no background capture survives.
            if(audio != null)audio.Dispose();audio=null;capture="error";
            if(hook != IntPtr.Zero){UnhookWinEvent(hook);hook=IntPtr.Zero;}contextEnabled=false;
        } finally { checking=false; }
    }
    private void Foreground() {
        string next="";uint pid;
        try {GetWindowThreadProcessId(GetForegroundWindow(),out pid);using(var process=Process.GetProcessById((int)pid))next=process.ProcessName+".exe";} catch {}
        if(next.Length>100)next="";application=next;Send(null);
    }
    private void Send(double[] bands) {
        lock(gate){if(sending || disposed)return;sending=true;}
        var payload=new Dictionary<string,object>();payload["capture"]=capture;
        if(contextEnabled)payload["application"]=application;
        if(bands!=null)payload["bands"]=bands;
        Task.Run(()=>{try{if(!disposed)Request("api/experiences/signal",payload);}catch{}finally{lock(gate)sending=false;}});
    }
    public void Dispose() {disposed=true;if(hook!=IntPtr.Zero){UnhookWinEvent(hook);hook=IntPtr.Zero;}if(audio!=null)audio.Dispose();audio=null;}
}

internal sealed class BandMeter {
    private readonly double lowAlpha, highAlpha;
    private double low, highLow;
    private readonly double[] energy = new double[3];
    private int count;
    internal BandMeter(int rate) { lowAlpha=1-Math.Exp(-2*Math.PI*200/rate);highAlpha=1-Math.Exp(-2*Math.PI*2000/rate); }
    internal void Add(double sample) {
        if(double.IsNaN(sample)||double.IsInfinity(sample))return;
        sample=Math.Max(-1,Math.Min(1,sample));low+=lowAlpha*(sample-low);highLow+=highAlpha*(sample-highLow);
        double mid=highLow-low, high=sample-highLow;energy[0]+=low*low;energy[1]+=mid*mid;energy[2]+=high*high;count++;
    }
    internal double[] Read() {var bands=new double[3];for(int i=0;i<3;i++){bands[i]=count==0?0:Math.Min(1,Math.Sqrt(energy[i]/count)*4);energy[i]=0;}count=0;return bands;}
}

internal sealed class LoopbackBands : IDisposable {
    private readonly Action<double[],string> publish;
    private volatile bool stopping;
    private Thread thread;
    internal bool Alive {get{return thread!=null&&thread.IsAlive;}}
    internal LoopbackBands(Action<double[],string> publish){this.publish=publish;}
    internal void Start(){thread=new Thread(Run){IsBackground=true,Name="Nexus audio bands"};thread.SetApartmentState(ApartmentState.MTA);thread.Start();}
    private void Run() {
        IMMDeviceEnumerator enumerator=null;IMMDevice device=null;IAudioClient client=null;IAudioCaptureClient capture=null;IntPtr format=IntPtr.Zero;bool started=false;
        try {
            enumerator=(IMMDeviceEnumerator)new DeviceEnumerator();Check(enumerator.GetDefaultAudioEndpoint(0,0,out device));
            object instance;Guid clientId=typeof(IAudioClient).GUID;Check(device.Activate(ref clientId,23,IntPtr.Zero,out instance));client=(IAudioClient)instance;
            Check(client.GetMixFormat(out format));
            int tag=(ushort)Marshal.ReadInt16(format,0),channels=(ushort)Marshal.ReadInt16(format,2),rate=Marshal.ReadInt32(format,4),align=(ushort)Marshal.ReadInt16(format,12),bits=(ushort)Marshal.ReadInt16(format,14);
            if(tag==65534 && Marshal.ReadInt16(format,16)>=22)tag=Marshal.ReadInt16(format,24);
            if(channels<1||channels>32||rate<8000||rate>384000||align!=channels*(bits/8)||!(tag==3&&bits==32||tag==1&&(bits==16||bits==24||bits==32)))throw new NotSupportedException();
            Guid session=Guid.Empty;Check(client.Initialize(0,0x20000,1000000,0,format,ref session));
            Guid captureId=typeof(IAudioCaptureClient).GUID;Check(client.GetService(ref captureId,out instance));capture=(IAudioCaptureClient)instance;
            var meter=new BandMeter(rate);var clock=Stopwatch.StartNew();long last=0;byte[] buffer=new byte[65536];Check(client.Start());started=true;publish(new double[3],"active");
            while(!stopping){
                uint frames;Check(capture.GetNextPacketSize(out frames));
                while(frames>0&&!stopping){
                    IntPtr data;uint available,flags;ulong position,qpc;Check(capture.GetBuffer(out data,out available,out flags,out position,out qpc));
                    try {
                        if(available>rate || (long)available*align>4*1024*1024)throw new IOException();
                        bool silent=(flags&2)!=0;int length=(int)available*align;if(!silent&&buffer.Length<length)buffer=new byte[length];byte[] bytes=silent?null:buffer;if(!silent)Marshal.Copy(data,bytes,0,length);
                        for(int frame=0;frame<(int)available;frame++){
                            double sample=0;if(!silent)for(int channel=0;channel<channels;channel++){int offset=frame*align+channel*(bits/8);double value;
                                if(tag==3)value=BitConverter.ToSingle(bytes,offset);
                                else if(bits==16)value=BitConverter.ToInt16(bytes,offset)/32768.0;
                                else if(bits==32)value=BitConverter.ToInt32(bytes,offset)/2147483648.0;
                                else{int v=bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16;if((v&0x800000)!=0)v|=unchecked((int)0xff000000);value=v/8388608.0;}sample+=value;
                            }meter.Add(sample/channels);
                        }
                    } finally {Check(capture.ReleaseBuffer(available));}
                    Check(capture.GetNextPacketSize(out frames));
                }
                if(clock.ElapsedMilliseconds-last>=125){last=clock.ElapsedMilliseconds;publish(meter.Read(),"active");}
                Thread.Sleep(20);
            }
        }catch{if(!stopping)publish(new double[3],"error");}
        finally{if(started)try{client.Stop();}catch{}if(format!=IntPtr.Zero)Marshal.FreeCoTaskMem(format);Release(capture);Release(client);Release(device);Release(enumerator);}
    }
    private static void Check(int hr){Marshal.ThrowExceptionForHR(hr);}
    private static void Release(object value){if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
    public void Dispose(){stopping=true;if(thread!=null&&thread!=Thread.CurrentThread)thread.Join(1500);}
    [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]private class DeviceEnumerator{}
    [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]private interface IMMDeviceEnumerator {
        [PreserveSig]int EnumAudioEndpoints(int flow,uint mask,out IntPtr collection);
        [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
    }
    [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]private interface IMMDevice {
        [PreserveSig]int Activate(ref Guid id,uint context,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)]out object value);
    }
    [ComImport,Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]private interface IAudioClient {
        [PreserveSig]int Initialize(int mode,uint flags,long duration,long periodicity,IntPtr format,ref Guid session);
        [PreserveSig]int GetBufferSize(out uint frames);
        [PreserveSig]int GetStreamLatency(out long latency);
        [PreserveSig]int GetCurrentPadding(out uint frames);
        [PreserveSig]int IsFormatSupported(int mode,IntPtr format,out IntPtr closest);
        [PreserveSig]int GetMixFormat(out IntPtr format);
        [PreserveSig]int GetDevicePeriod(out long normal,out long minimum);
        [PreserveSig]int Start();[PreserveSig]int Stop();[PreserveSig]int Reset();
        [PreserveSig]int SetEventHandle(IntPtr handle);
        [PreserveSig]int GetService(ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object service);
    }
    [ComImport,Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]private interface IAudioCaptureClient {
        [PreserveSig]int GetBuffer(out IntPtr data,out uint frames,out uint flags,out ulong position,out ulong qpc);
        [PreserveSig]int ReleaseBuffer(uint frames);[PreserveSig]int GetNextPacketSize(out uint frames);
    }
}
