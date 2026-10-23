using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

// Lives in the existing SYSTEM hardware supervisor, never in the HTTP service.
// Only a matching development/alpha payload enables it. No sensor is opened here.
internal sealed class CoolingLaunchBroker : IDisposable {
    private readonly string root, name;
    private readonly Func<int,bool> validate;
    private readonly Func<int,string,int> launch;
    private readonly SecurityIdentifier clientSid;
    private volatile bool stopping;
    private NamedPipeServerStream current;
    private readonly object gate=new object();
    private readonly JavaScriptSerializer json=new JavaScriptSerializer { MaxJsonLength=2048 };
    private Process active;
    [DllImport("kernel32.dll",SetLastError=true)] private static extern bool GetNamedPipeClientProcessId(IntPtr pipe,out uint pid);
    internal static CoolingLaunchBroker StartInstalled(string root) {
        try {
            if(!WindowsIdentity.GetCurrent().IsSystem)return null;
            if(!PackageEligible(root))return null;
            var broker=new CoolingLaunchBroker(root,"NexusRGB.Cooling.Launch.v1",null,null,new SecurityIdentifier(WellKnownSidType.LocalServiceSid,null));
            broker.Start();return broker;
        }catch{return null;}
    }
    internal static bool PackageEligible(string root) {
        try {
            var serializer=new JavaScriptSerializer();
            var build=serializer.DeserializeObject(File.ReadAllText(Path.Combine(root,@"server\build-info.json"))) as Dictionary<string,object>;
            if(build==null||!build.ContainsKey("development")||!build.ContainsKey("tag"))return false;
            bool development=true.Equals(build["development"])&&build["tag"]==null;
            bool alpha=false.Equals(build["development"])&&build["tag"] is string&&Regex.IsMatch((string)build["tag"],@"^v\d+\.\d+\.\d+-alpha\.[1-9]\d*$");
            bool legacy=development&&!File.Exists(Path.Combine(root,@"server\cooling-package.json"));
            var marker=serializer.DeserializeObject(File.ReadAllText(Path.Combine(root,legacy?@"server\cooling-development.json":@"server\cooling-package.json"))) as Dictionary<string,object>;
            if((!development&&!alpha)||marker==null||
               !build.ContainsKey("commit")||!(build["commit"] is string)||!Regex.IsMatch((string)build["commit"],"^[a-f0-9]{40}$")||
               !marker.ContainsKey("format")||!(legacy?"nexus-cooling-development/1":"nexus-cooling-package/1").Equals(marker["format"])||!marker.ContainsKey("commit")||!build["commit"].Equals(marker["commit"])||
               !File.Exists(Path.Combine(root,@"cooling\nexus-cooling.exe")))return false;
            return true;
        }catch{return false;}
    }
    // Trusted adapters are used by the native IPC fixture, never by request data.
    internal CoolingLaunchBroker(string root,string name,Func<int,bool> validate,Func<int,string,int> launch,SecurityIdentifier clientSid){
        this.root=Path.GetFullPath(root);this.name=name;this.validate=validate??ValidateInstalledClient;this.launch=launch??LaunchInstalled;this.clientSid=clientSid;
    }
    internal void Start(){new Thread(Serve){IsBackground=true,Name="NexusCoolingLaunch"}.Start();}
    private bool ValidateInstalledClient(int pid){
        // WMI is used once per launch, not on the sampling/render loops.
        int service=0;
        using(var query=new ManagementObjectSearcher("SELECT ProcessId FROM Win32_Service WHERE Name='NexusRGB'")){
            query.Scope.Options.EnablePrivileges=true;query.Options.Timeout=TimeSpan.FromSeconds(3);
            using(var rows=query.Get())foreach(ManagementObject row in rows){using(row)service=Convert.ToInt32(row["ProcessId"]);}
        }
        if(service<=0)return false;
        using(var query=new ManagementObjectSearcher("SELECT ParentProcessId,ExecutablePath FROM Win32_Process WHERE ProcessId="+pid)){
            query.Scope.Options.EnablePrivileges=true;query.Options.Timeout=TimeSpan.FromSeconds(3);
            using(var rows=query.Get())foreach(ManagementObject row in rows){using(row){
                return Convert.ToInt32(row["ParentProcessId"])==service&&string.Equals(row["ExecutablePath"] as string,Path.Combine(root,@"runtime\node.exe"),StringComparison.OrdinalIgnoreCase);
            }}
        }
        return false;
    }
    private int LaunchInstalled(int parent,string pipe){
        if(active!=null){if(!active.HasExited)throw new InvalidOperationException("O auxiliar anterior ainda está encerrando. Aguarde.");active.Dispose();active=null;}
        string script=Path.Combine(root,@"scripts\start-cooling-helper.ps1"),helper=Path.Combine(root,@"cooling\nexus-cooling.exe");
        string shell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),@"System32\WindowsPowerShell\v1.0\powershell.exe");
        string args="-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \""+script+"\" -Executable \""+helper+"\" -Pipe "+pipe+" -ParentPid "+parent;
        using(var process=Process.Start(new ProcessStartInfo(shell,args){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true})){
            var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();
            if(!process.WaitForExit(12000)||!output.Wait(1000)||process.ExitCode!=0)throw new InvalidOperationException("Não foi possível iniciar o auxiliar pelo serviço de hardware.");
            int pid;if(!int.TryParse(output.Result.Trim(),out pid)||pid<=0)throw new InvalidOperationException("Identidade do auxiliar inválida.");
            active=Process.GetProcessById(pid);return pid;
        }
    }
    private void Serve(){
        while(!stopping){
            try{
                var acl=new PipeSecurity();
                acl.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User,PipeAccessRights.FullControl,AccessControlType.Allow));
                // libuv opens duplex pipes with GENERIC_WRITE, which includes
                // FILE_APPEND_DATA (= CREATE_PIPE_INSTANCE), plus synchronize.
                acl.AddAccessRule(new PipeAccessRule(clientSid,PipeAccessRights.ReadWrite|PipeAccessRights.CreateNewInstance|PipeAccessRights.Synchronize,AccessControlType.Allow));
                acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid,null),PipeAccessRights.FullControl,AccessControlType.Deny));
                using(var pipe=new NamedPipeServerStream(name,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,acl)){
                    lock(gate){if(stopping)return;current=pipe;}
                    var connection=pipe.BeginWaitForConnection(null,null);
                    while(!stopping&&!connection.AsyncWaitHandle.WaitOne(1000)){}
                    if(stopping)return;pipe.EndWaitForConnection(connection);
                    using(var reader=new StreamReader(pipe,new UTF8Encoding(false),false,1024,true))
                    using(var writer=new StreamWriter(pipe,new UTF8Encoding(false),1024,true){AutoFlush=true}){
                        try{
                            uint actual;if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle.DangerousGetHandle(),out actual)||!validate((int)actual))throw new InvalidOperationException("Cliente de ventilação não autorizado.");
                            var input=System.Threading.Tasks.Task.Run(()=>ReadBounded(reader));
                            if(!input.Wait(3000))throw new InvalidOperationException("Pedido de ventilação expirou.");
                            var body=json.DeserializeObject(input.Result) as Dictionary<string,object>;
                            if(body==null||body.Count!=2||!body.ContainsKey("parent")||!(body["parent"] is int)||!body.ContainsKey("pipe")||!(body["pipe"] is string)||
                               (int)body["parent"]!=(int)actual||!Regex.IsMatch((string)body["pipe"],@"^NexusRGB\.Cooling\.Dev\.[a-f0-9]{32}$"))throw new InvalidOperationException("Pedido de ventilação inválido.");
                            if(stopping)throw new InvalidOperationException("O serviço de hardware está encerrando.");
                            int pid=launch((int)actual,(string)body["pipe"]);
                            writer.WriteLine(json.Serialize(new{status="ok",pid=pid}));
                        }catch(InvalidOperationException error){writer.WriteLine(json.Serialize(new{status="error",message=error.Message}));}
                        catch{writer.WriteLine(json.Serialize(new{status="error",message="Falha na autorização do auxiliar de ventilação."}));}
                    }
                }
            }catch{if(!stopping)Thread.Sleep(500);}
            finally{lock(gate){current=null;}}
        }
    }
    private static string ReadBounded(TextReader input){
        var result=new StringBuilder();int c;
        while((c=input.Read())>=0){if(c=='\n')return result.ToString();if(result.Length>=1024)throw new InvalidDataException();result.Append((char)c);}
        throw new InvalidDataException();
    }
    public void Dispose(){stopping=true;lock(gate){if(current!=null)current.Dispose();}if(active!=null)active.Dispose();}
}
