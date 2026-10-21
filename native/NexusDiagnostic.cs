// Portable read-only collector. Framework libraries only; no sensor/SMBus/ADL probing.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Security.Cryptography;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly:System.Reflection.AssemblyTitle("Nexus RGB GPU diagnostics (development)")]
[assembly:System.Reflection.AssemblyVersion("0.1.0.0")]
[assembly:System.Reflection.AssemblyCopyright("Copyright JonJonGf. MIT license.")]

internal static class Diagnostic {
    internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength=2097152, RecursionLimit=64 };
    internal static Dictionary<string,object> Map(object value) { return value as Dictionary<string,object> ?? new Dictionary<string,object>(); }
    internal static object Get(object value,string key) { object result; return Map(value).TryGetValue(key,out result)?result:null; }
    internal static object[] Rows(object value) { var list=value as IEnumerable; return list==null || value is string || value is IDictionary ? new object[0] : list.Cast<object>().Take(128).ToArray(); }
    internal static string Text(object value) { return value as string ?? ""; }
    internal static object Number(object value,int min=0,int max=65535) { double n; return value!=null && !(value is bool) && double.TryParse(Convert.ToString(value,System.Globalization.CultureInfo.InvariantCulture),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out n) && !double.IsNaN(n) && n>=min && n<=max ? (object)n : null; }
    internal static object Bool(object value) { return value is bool ? value:null; }
    internal static string Token(object value,string pattern,int max) { var s=Text(value);return s.Length<=max && Regex.IsMatch(s,"\\A(?:"+pattern+")\\z")?s:"unavailable"; }
    internal static Dictionary<string,object> D(params object[] items) { var d=new Dictionary<string,object>();for(int i=0;i<items.Length;i+=2)d[(string)items[i]]=items[i+1];return d; }
    internal static string PublicLabel(object value) {
        // Descriptors are not trusted as arbitrary free text. Keep only known hardware terms.
        string s=Text(value);if(s.Length>160)return "unrecognized descriptor";
        var allowed=Regex.Matches(s,@"(?i)\b(?:gigabyte|radeon|nvidia|geforce|amd|intel|asus|msi|asrock|sapphire|powercolor|zotac|palit|evga|pny|rx|rtx|gtx|arc|gaming|oc|xt|nitro|red|devil|aorus|eagle|gpu|zone|direct|static|solid|custom|off|color|breathing|rainbow|wave|flash|pulse|[0-9]{1,4}[a-z]{0,2})\b");
        return allowed.Count==0?"unrecognized descriptor":string.Join(" ",allowed.Cast<Match>().Select(m=>m.Value).Take(24));
    }
    internal static Dictionary<string,object> Project(object source) {
        var build=Get(source,"build"); var hw=Get(source,"hardware");var aliases=new Dictionary<string,string>();
        var devices=Rows(Get(hw,"devices")).Where(d=>Convert.ToString(Get(d,"type"))=="2").Take(64).Select((device,index)=>{
            string key=Text(Get(device,"controllerId"));if(key=="")key="unknown-"+index;
            if(!aliases.ContainsKey(key))aliases[key]="gpu-"+(aliases.Count+1);
            var settings=Get(device,"settings");
            return D("alias",aliases[key],"zone",index+1,"model",PublicLabel(Get(device,"controllerName")??Get(device,"name")),"ledCount",Number(Get(device,"ledCount"),0,4096),
                "status",Token(Get(device,"status"),"online|offline|error",12),"spatialCapable",Bool(Get(device,"spatialCapable")),
                "mapExcluded",Bool(Get(device,"mapExcluded")),"requested",D("power",Bool(Get(settings,"power")),"brightness",Number(Get(settings,"brightness"),0,100),"nativeMode",Number(Get(settings,"nativeMode"))),
                "modes",Rows(Get(device,"modes")).Take(64).Select(m=>D("id",Number(Get(m,"id")),"name",PublicLabel(Get(m,"name")))).ToArray());
        }).ToArray();
        var findings=new List<string>{"SDK connection and requested values are not proof that physical LEDs accepted a command.","This collector does not change lighting, install drivers, restart services or upload files.","A missing mode list on a split zone is not evidence of a missing GPU driver."};
        if(devices.Length==0)findings.Add("No GPU zones in the captured Nexus state. Check collection availability before inferring unsupported hardware.");
        else if(Get(hw,"connected") is bool && (bool)Get(hw,"connected"))findings.Add("SDK reports connected. Physical GPU color remains unverified; compare the saved requested state with the observed LED behavior.");
        if(devices.Any(d=>Get(Get(d,"requested"),"power") is bool && !(bool)Get(Get(d,"requested"),"power")))findings.Add("At least one GPU zone is requested off.");
        return D("format","nexus-gpu-report/1","createdAt",DateTime.UtcNow.ToString("o"),"collector",D("development",true,"version",1),
            "build",D("version",Token(Get(build,"version"),@"[0-9]+\.[0-9]+\.[0-9]+",32),"tag",Token(Get(build,"tag"),@"v[0-9]+\.[0-9]+\.[0-9]+(?:-alpha\.[0-9]+)?",50),"commit",Token(Get(build,"commit"),"[a-f0-9]{40}",40),"development",Bool(Get(build,"development"))),
            "controller",D("connected",Bool(Get(hw,"connected")),"hung",Bool(Get(hw,"controllerHung")),"detecting",Bool(Get(hw,"detecting")),"hasError",!string.IsNullOrEmpty(Text(Get(hw,"error"))),"devices",devices,"physicalConfirmation","not-measured"),
            "requestedMaster",D("power",Bool(Get(Get(source,"master"),"power")),"brightness",Number(Get(Get(source,"master"),"brightness"),0,100)),"findings",findings);
    }
    internal static object ReadJson(string path) { var file=new FileInfo(path);if(!file.Exists||file.Length>2097152)throw new InvalidDataException();return Json.DeserializeObject(File.ReadAllText(path)); }
    internal static object Fetch(string origin,string route,CookieContainer cookies,bool session=false) {
        var request=(HttpWebRequest)WebRequest.Create(origin+route);request.Proxy=null;request.AllowAutoRedirect=false;request.Timeout=3000;request.ReadWriteTimeout=3000;request.CookieContainer=cookies;
        if(session){request.Method="POST";request.Headers["Origin"]=origin;request.Headers["X-Nexus-Client"]="web";request.ContentType="application/json";request.ContentLength=2;using(var stream=request.GetRequestStream()){stream.Write(new byte[]{123,125},0,2);}}
        using(var response=(HttpWebResponse)request.GetResponse())using(var stream=response.GetResponseStream())using(var output=new MemoryStream()) {
            byte[] buffer=new byte[8192];int count;while((count=stream.Read(buffer,0,buffer.Length))>0){if(output.Length+count>2097152)throw new InvalidDataException();output.Write(buffer,0,count);}return Json.DeserializeObject(Encoding.UTF8.GetString(output.ToArray()));
        }
    }
    internal static string InstallRoot() {
        using(var root=RegistryKey.OpenBaseKey(RegistryHive.LocalMachine,RegistryView.Registry64))
        using(var key=root.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{BEFFBF04-40A0-4E59-87C0-223B51E92B84}_is1")) {
            string folder=key==null?null:key.GetValue("InstallLocation") as string;
            if(string.IsNullOrEmpty(folder)||!Path.IsPathRooted(folder)||!Directory.Exists(folder))return null;
            return Path.GetFullPath(folder);
        }
    }
    internal static object Service(string name) { try{using(var service=new ServiceController(name))return D("name",name,"status",service.Status.ToString());}catch{return D("name",name,"status","unavailable");} }
    internal static object[] Wmi(string query,Func<ManagementObject,object> project) {
        try { var options=new EnumerationOptions{Timeout=TimeSpan.FromSeconds(5)};using(var searcher=new ManagementObjectSearcher(new ManagementScope(@"root\CIMV2"),new ObjectQuery(query),options))using(var result=searcher.Get())return result.Cast<ManagementObject>().Take(16).Select(project).ToArray(); }
        catch{return new object[]{D("collection","unavailable")};}
    }
    internal static object HardwareInfo() {
        return D("gpus",Wmi("SELECT Name,DriverVersion,DriverDate,PNPDeviceID FROM Win32_VideoController",row=>{
            var ids=Regex.Matches(Convert.ToString(row["PNPDeviceID"]),@"(?i)(?:VEN|DEV)_[0-9A-F]{4}|SUBSYS_[0-9A-F]{8}").Cast<Match>().Select(m=>m.Value.ToUpperInvariant()).ToArray();
            return D("model",PublicLabel(row["Name"]),"driverVersion",Token(row["DriverVersion"],@"[0-9.]+",64),"driverDate",Token(row["DriverDate"],@"[0-9.+-]+",32),"pciIds",ids);
        }),"boards",Wmi("SELECT Manufacturer,Product FROM Win32_BaseBoard",row=>D("manufacturer",PublicLabel(row["Manufacturer"]),"product",Token(row["Product"],@"[A-Za-z0-9 ()._-]+",80))));
    }
    internal static object LogSummary(string folder) {
        // No raw log text or exception messages ever leave this method.
        var result=new List<object>();
        foreach(var part in new[]{"app","hardware"}) {
            string file=Path.Combine(folder,part,"service.log");
            try {
                byte[] data;using(var stream=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete)){stream.Seek(Math.Max(0,stream.Length-262144),SeekOrigin.Begin);data=new byte[(int)(stream.Length-stream.Position)];int offset=0,n;while(offset<data.Length&&(n=stream.Read(data,offset,data.Length-offset))>0)offset+=n;}
                var text=Encoding.UTF8.GetString(data);var counts=new Dictionary<string,object>();
                foreach(var pair in new[]{new[]{"pawnio-module-load-failed",@"(?i)pawnio_load.*failed|PawnIO.*module.*(?:fail|error)"},new[]{"hresult-80070490",@"(?i)0x80070490"},new[]{"sdk-timeout",@"(?i)ETIMEDOUT|timed out|timeout"},new[]{"sdk-disconnected",@"(?i)ECONNRESET|ECONNREFUSED|recv_select"},new[]{"gigabyte-detector",@"(?i)Gigabyte.*(?:GPU|Fusion)"},new[]{"fusion2-invalid-response",@"(?i)Gigabyte RGB Fusion2 GPU.*invalid.*Expected 0xAB"},new[]{"fusion2-mirrored-response",@"(?i)received:\s*0xAB\s+0xAB\s+0xAB\s+0xAB"},new[]{"amd-adl-registration",@"(?i)ADL GPU Device|Registering I2C interface:.*AMD ADL"}})counts[pair[0]]=Regex.Matches(text,pair[1]).Count;
                result.Add(D("source",part,"state","read-tail","tailLimitBytes",262144,"signatures",counts));
            }catch(UnauthorizedAccessException){result.Add(D("source",part,"state","access-denied"));}catch{result.Add(D("source",part,"state","unavailable"));}
        }
        return result;
    }
    internal static object Files(string root) {
        return new[]{@"openrgb\OpenRGB.exe",@"server\hardware.js",@"server\openrgb-client.js"}.Select(relative=>{
            try{string file=Path.Combine(root,relative);using(var stream=File.OpenRead(file))using(var sha=SHA256.Create())return D("file",relative.Replace('\\','/'),"sha256",BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant());}
            catch{return D("file",relative.Replace('\\','/'),"state","unavailable");}
        }).ToArray();
    }
    internal static Dictionary<string,object> Collect(bool system,bool logs,bool application,int localPort) {
        object state=D();string root=null;var availability=new Dictionary<string,object>();
        try{root=InstallRoot();}catch{}
        object build=D();if(root!=null){try{build=ReadJson(Path.Combine(root,@"server\build-info.json"));}catch{availability["build"]="unavailable";}}
        if(application) {
            var origin="http://127.0.0.1:"+localPort;var cookies=new CookieContainer();
            try {
                var handshake=Fetch(origin,"/api/health",cookies);if(Text(Get(handshake,"application"))!="nexus-rgb")throw new InvalidDataException();
                Fetch(origin,"/api/session/local",cookies,true);state=Fetch(origin,"/api/state",cookies);availability["application"]="collected";
                try{var diagnostic=Fetch(origin,"/api/diagnostics",cookies);build=Get(diagnostic,"build")??build;Map(state)["safeDiagnostic"]=diagnostic;}catch{availability["engineSummary"]="unavailable";}
            } catch(WebException error){availability["application"]=error.Response is HttpWebResponse?"http-"+(int)((HttpWebResponse)error.Response).StatusCode:error.Status==WebExceptionStatus.Timeout?"timeout":"connection-unavailable";}
            catch {availability["application"]="invalid-response";}
        }
        Map(state)["build"]=build;var report=Project(state);report["collection"]=availability;
        var diag=Get(state,"safeDiagnostic");var health=Get(diag,"health");var render=Get(diag,"render");var errors=Get(diag,"errors");
        if(diag!=null)report["engineSummary"]=D("health",Token(Get(health,"state"),"ready|connecting|disconnected|detecting|partial|controller-hung",24),"componentErrors",Number(Get(health,"componentErrors")),"spatial",Bool(Get(render,"spatial")),"requestedFps",Number(Get(render,"requestedFps"),0,60),"renderedFps",Number(Get(render,"fps"),0,240),"controllerLost",Bool(Get(errors,"controllerLost")),"hardwareErrorCode",Token(Get(errors,"hardwareErrorCode"),"waiting-controller|timeout|disconnected|controller-error|controller-hung",24));
        if(application){report["services"]=new[]{Service("NexusRGB"),Service("NexusRGBHardware"),Service("PawnIO")};report["files"]=root==null?new object[0]:Files(root);}
        if(system) {
            report["system"]=HardwareInfo();
            var known=new HashSet<string>(new[]{"rgbfusion","rgbfusion2","gcc","gcc.exe","ledkeeper","ledkeeper2","signalrgb","openrgb","lightingservice","armourycrate","icue","msi.center"},StringComparer.OrdinalIgnoreCase);
            var names=new List<string>();foreach(var p in Process.GetProcesses()){try{if(known.Contains(p.ProcessName))names.Add(p.ProcessName.ToLowerInvariant());}catch{}finally{p.Dispose();}}
            report["rgbApplicationNames"]=names.Distinct().ToArray();
            ((List<string>)report["findings"]).Add("An RGB process name alone does not prove contention; the expected Nexus OpenRGB process may be listed.");
        }
        if(logs)report["logSummary"]=LogSummary(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"NexusRGB"));
        return report;
    }
    internal static int PanelPort() { try{using(var key=Registry.LocalMachine.OpenSubKey(@"SOFTWARE\NexusRGB")){object n=key==null?null:key.GetValue("PanelPort");if(n is int && (int)n>=1024&&(int)n<=65535)return (int)n;}}catch{}return 5050; }
    [STAThread] static int Main(string[] args) {
        if(args.Length==2 && args[0]=="--fixture") {try{using(var writer=new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false))){writer.WriteLine(Json.Serialize(Project(ReadJson(args[1]))));}return 0;}catch{Console.Error.WriteLine("Fixture unavailable or invalid.");return 2;}}
        if(args.Length==2 && args[0]=="--api-fixture") {int p;if(!int.TryParse(args[1],out p)||p<1024||p>65535)return 2;try{using(var writer=new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false))){writer.WriteLine(Json.Serialize(Collect(false,false,true,p)));}return 0;}catch{return 2;}}
        if(args.Length==3 && args[0]=="--ui-fixture") {
            try{Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);using(var form=new ReviewForm(ReadJson(args[1]))){form.Shown+=(s,e)=>{using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(Point.Empty,form.Size));bitmap.Save(args[2],System.Drawing.Imaging.ImageFormat.Png);}form.Close();};Application.Run(form);}return 0;}catch{return 2;}
        }
        if(args.Length>0)return 2;
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new ReviewForm());return 0;
    }
}

internal sealed class ReviewForm : Form {
    readonly CheckBox application=new CheckBox{Text="Nexus: versão, serviços e estado solicitado / app state",Checked=true,AutoSize=true};
    readonly CheckBox system=new CheckBox{Text="Modelos, drivers e possíveis conflitos RGB / system",Checked=true,AutoSize=true};
    readonly CheckBox logs=new CheckBox{Text="Resumo de erros dos logs (sem texto bruto) / log signatures",Checked=false,AutoSize=true};
    readonly NumericUpDown port=new NumericUpDown{Minimum=1024,Maximum=65535,Value=Diagnostic.PanelPort(),Width=90};
    readonly Button collect=new Button{Text="Coletar / Collect",AutoSize=true};
    readonly Button save=new Button{Text="Salvar relatório / Save",AutoSize=true,Enabled=false};
    readonly TextBox preview=new TextBox{Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Both,WordWrap=false,Dock=DockStyle.Fill,Font=new Font("Consolas",10)};
    readonly Label status=new Label{Text="Nada coletado. / Nothing collected.",AutoSize=true};
    string report;
    internal ReviewForm(object fixture=null) {
        Text="Nexus RGB · Diagnóstico GPU / GPU diagnostics · Desenvolvimento";Width=1020;Height=740;MinimumSize=new Size(700,550);StartPosition=FormStartPosition.CenterScreen;
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=1,RowCount=4,Padding=new Padding(16)};
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        var intro=new Label{AutoSize=true,MaximumSize=new Size(920,0),Text="Diagnóstico portátil e somente leitura. Não muda RGB, não instala drivers, não reinicia e não envia arquivos.\r\nRead-only collector. No RGB writes, driver installs, restarts or uploads. Review the exact report below before saving.\r\nLogs protegidos podem ficar indisponíveis: executar como administrador é opcional. Não desative o antivírus."};
        var options=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown};
        options.Controls.Add(application);options.Controls.Add(system);options.Controls.Add(logs);
        var controls=new FlowLayoutPanel{AutoSize=true};controls.Controls.Add(new Label{Text="Porta do painel / Panel port",AutoSize=true,Padding=new Padding(0,5,0,0)});controls.Controls.Add(port);controls.Controls.Add(collect);controls.Controls.Add(save);options.Controls.Add(controls);
        layout.Controls.Add(intro,0,0);layout.Controls.Add(options,0,1);layout.Controls.Add(preview,0,2);layout.Controls.Add(status,0,3);Controls.Add(layout);
        foreach(var check in new[]{application,system,logs})check.CheckedChanged+=(s,e)=>InvalidateReport();port.ValueChanged+=(s,e)=>InvalidateReport();
        collect.Click+=async(s,e)=>{
            bool a=application.Checked,b=system.Checked,c=logs.Checked;int p=(int)port.Value;
            collect.Enabled=false;save.Enabled=false;foreach(var check in new[]{application,system,logs})check.Enabled=false;port.Enabled=false;status.Text="Coletando localmente… / Collecting locally…";
            try{var value=await Task.Run(()=>fixture==null?Diagnostic.Collect(b,c,a,p):Diagnostic.Project(fixture));report=Pretty(Diagnostic.Json.Serialize(value));preview.Text=report;save.Enabled=true;status.Text="Revise os dados acima. A confirmação física continua pendente. / Review before sharing; physical LEDs not measured.";}
            catch{InvalidateReport();status.Text="Coleta indisponível. Nenhuma alteração de hardware foi feita. / Collection unavailable.";}
            finally{collect.Enabled=true;foreach(var check in new[]{application,system,logs})check.Enabled=true;port.Enabled=true;}
        };
        save.Click+=(s,e)=>{using(var dialog=new SaveFileDialog{Filter="JSON report (*.json)|*.json",FileName="NexusRGB-GPU-diagnostic.json"})if(dialog.ShowDialog(this)==DialogResult.OK){try{File.WriteAllText(dialog.FileName,report,new UTF8Encoding(false));status.Text="Salvo localmente. Envie somente se desejar. / Saved locally. Share manually if you choose.";}catch{status.Text="Não foi possível salvar. / Could not save.";}}};
        if(fixture!=null){report=Pretty(Diagnostic.Json.Serialize(Diagnostic.Project(fixture)));preview.Text=report;save.Enabled=true;status.Text="SIMULAÇÃO / FIXTURE · Nenhum dispositivo consultado. / No hardware queried.";}
    }
    void InvalidateReport(){report=null;preview.Clear();save.Enabled=false;status.Text="Seleção alterada: colete novamente. / Selection changed: collect again.";}
    static string Pretty(string text) {
        var b=new StringBuilder();int depth=0;bool quoted=false,escape=false;
        foreach(char c in text){if(quoted){b.Append(c);if(escape)escape=false;else if(c=='\\')escape=true;else if(c=='"')quoted=false;continue;}if(c=='"'){quoted=true;b.Append(c);}else if(c=='{'||c=='['){b.Append(c).AppendLine();depth++;b.Append(' ',depth*2);}else if(c=='}'||c==']'){b.AppendLine();depth--;b.Append(' ',depth*2).Append(c);}else if(c==','){b.Append(c).AppendLine().Append(' ',depth*2);}else if(c==':')b.Append(": ");else b.Append(c);}return b.ToString();
    }
}
