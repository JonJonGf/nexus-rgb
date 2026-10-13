using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal static class Program {
    internal static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    internal const string Panel = "http://127.0.0.1:5050/";
    [STAThread]
    private static void Main(string[] args) {
        if (Array.IndexOf(args, "--service") >= 0) { ServiceBase.Run(new Worker(false)); return; }
        if (Array.IndexOf(args, "--hardware-service") >= 0) { ServiceBase.Run(new Worker(true)); return; }
        if (Array.IndexOf(args, "--self-test") >= 0) {
            if (!File.Exists(Path.Combine(Root, "runtime", "node.exe")) || !File.Exists(Path.Combine(Root, "server", "index.js")) || !File.Exists(Path.Combine(Root, "openrgb", "OpenRGB.exe"))) Environment.Exit(2);
            Environment.Exit(0); return;
        }
        bool open = Array.IndexOf(args, "--tray") < 0;
        bool created;
        using (var mutex = new Mutex(true, "Local\\NexusRGB.Tray", out created)) {
            if (!created) { if (open) OpenPanel(); return; }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Tray(open));
        }
    }
    internal static void OpenPanel() {
        // The browser renders local HTML; it never receives native privileges.
        string[] paths = { Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe") };
        foreach (string path in paths) if (File.Exists(path)) { Process.Start(new ProcessStartInfo(path, "--app=" + Panel) { UseShellExecute = true }); return; }
        Process.Start(new ProcessStartInfo(Panel) { UseShellExecute = true });
    }
}
internal sealed class Tray : ApplicationContext {
    private readonly NotifyIcon icon;
    private readonly System.Windows.Forms.Timer timer;
    private readonly ToolStripMenuItem status;
    internal Tray(bool open) {
        var menu = new ContextMenuStrip();
        status = new ToolStripMenuItem("Nexus RGB: verificando serviço") { Enabled = false }; menu.Items.Add(status);
        menu.Items.Add("Abrir Nexus RGB", null, (s, e) => Program.OpenPanel());
        menu.Items.Add("Copiar link para o celular", null, (s, e) => CopyLink());
        menu.Items.Add("Abrir pasta de diagnósticos", null, (s, e) => Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "NexusRGB", "app")) { UseShellExecute = true }));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Fechar ícone (manter as luzes)", null, (s, e) => ExitThread());
        string ico = Path.Combine(Program.Root, "app.ico");
        icon = new NotifyIcon { Icon = File.Exists(ico) ? new Icon(ico) : SystemIcons.Application, Text = "Nexus RGB", ContextMenuStrip = menu, Visible = true };
        icon.DoubleClick += (s, e) => Program.OpenPanel();
        timer = new System.Windows.Forms.Timer { Interval = 5000 }; timer.Tick += (s, e) => CheckStatus(); timer.Start();
        CheckStatus(); if (open) Program.OpenPanel();
    }
    private void CheckStatus() {
        try { using (var service = new ServiceController("NexusRGB")) { status.Text = service.Status == ServiceControllerStatus.Running ? "Nexus RGB: serviço ativo" : "Nexus RGB: serviço parado"; } }
        catch { status.Text = "Nexus RGB: instale o serviço pelo instalador"; }
    }
    private void CopyLink() {
        foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces()) {
            if (adapter.OperationalStatus != OperationalStatus.Up || adapter.NetworkInterfaceType == NetworkInterfaceType.Loopback || adapter.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
            string name = adapter.Name.ToLowerInvariant(); if (name.Contains("virtual") || name.Contains("vethernet") || name.Contains("vpn") || name.Contains("tailscale")) continue;
            foreach (var address in adapter.GetIPProperties().UnicastAddresses) {
                byte[] ip = address.Address.GetAddressBytes();
                if (ip.Length == 4 && (ip[0] == 10 || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] == 192 && ip[1] == 168))) {
                    Clipboard.SetText("http://" + address.Address + ":5050/"); icon.ShowBalloonTip(3000, "Link copiado", "Abra este endereço no celular conectado ao mesmo Wi-Fi.", ToolTipIcon.Info); return;
                }
            }
        }
        icon.ShowBalloonTip(3000, "Rede indisponível", "Conecte o PC a uma rede Wi-Fi ou Ethernet privada.", ToolTipIcon.Warning);
    }
    protected override void ExitThreadCore() { timer.Stop(); timer.Dispose(); icon.Visible = false; icon.Dispose(); base.ExitThreadCore(); }
}
internal sealed class Worker : ServiceBase {
    private readonly bool hardware;
    private readonly object gate = new object();
    private Process child;
    private System.Threading.Timer timer;
    private IntPtr job;
    private bool stopping;
    private DateTime nextStart = DateTime.MinValue;
    private int failures;
    private string data;
    internal Worker(bool hardware) { this.hardware = hardware; ServiceName = hardware ? "NexusRGBHardware" : "NexusRGB"; CanStop = true; CanShutdown = true; AutoLog = true; }
    protected override void OnStart(string[] args) {
        data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "NexusRGB", hardware ? "hardware" : "app");
        if (!Directory.Exists(data)) throw new DirectoryNotFoundException("Use o instalador para criar a pasta do serviço.");
        job = Job.Create(); timer = new System.Threading.Timer(Tick, null, 0, 1000);
    }
    private void Log(string message) {
        lock (gate) {
            try { string file = Path.Combine(data, "service.log"); if (File.Exists(file) && new FileInfo(file).Length > 2 * 1024 * 1024) { string old = file + ".old"; if (File.Exists(old)) File.Delete(old); File.Move(file, old); } File.AppendAllText(file, DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine, Encoding.UTF8); }
            catch { /* Service logging must not bring down the supervisor. */ }
        }
    }
    private void Tick(object unused) {
        lock (gate) {
            if (stopping) return;
            if (child != null && !child.HasExited) return;
            if (child != null) { Log("Processo encerrou com código " + child.ExitCode); if ((DateTime.UtcNow - child.StartTime.ToUniversalTime()).TotalMinutes > 5) failures = 0; child.Dispose(); child = null; failures++; nextStart = DateTime.UtcNow.AddSeconds(Math.Min(30, Math.Pow(2, Math.Min(failures, 5)))); }
            if (DateTime.UtcNow < nextStart) return;
            try {
                string exe = Path.Combine(Program.Root, hardware ? "openrgb\\OpenRGB.exe" : "runtime\\node.exe");
                string arguments = hardware ? "--server --server-host 127.0.0.1 --server-port 6743 --noautoconnect --config \"" + data + "\"" : "\"" + Path.Combine(Program.Root, "server", "index.js") + "\"";
                var info = new ProcessStartInfo(exe, arguments) { WorkingDirectory = Program.Root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
                if (!hardware) { info.EnvironmentVariables["NEXUS_DATA_DIR"] = data; info.EnvironmentVariables["NEXUS_PORT"] = "5050"; info.EnvironmentVariables["NEXUS_RGB_PORT"] = "6743"; info.EnvironmentVariables["NODE_ENV"] = "production"; info.EnvironmentVariables.Remove("NODE_OPTIONS"); info.EnvironmentVariables.Remove("NODE_PATH"); }
                child = new Process { StartInfo = info }; child.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); }; child.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                child.Start(); if (!Job.Assign(job, child.Handle)) { child.Kill(); throw new InvalidOperationException("Não foi possível supervisionar o processo."); }
                child.BeginOutputReadLine(); child.BeginErrorReadLine(); Log("Processo iniciado: " + child.Id);
            } catch (Exception error) { Log("Falha ao iniciar: " + error.Message); if (child != null) { child.Dispose(); child = null; } nextStart = DateTime.UtcNow.AddSeconds(15); }
        }
    }
    protected override void OnStop() {
        lock (gate) { stopping = true; if (timer != null) timer.Dispose(); if (job != IntPtr.Zero) { Job.Close(job); job = IntPtr.Zero; } }
    }
    protected override void OnShutdown() { OnStop(); base.OnShutdown(); }
}
internal static class Job {
    [StructLayout(LayoutKind.Sequential)] private struct Basic { public long UserTime, JobTime; public uint Flags; public UIntPtr Min, Max; public uint Active; public UIntPtr Affinity; public uint Priority, Scheduling; }
    [StructLayout(LayoutKind.Sequential)] private struct Io { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct Extended { public Basic Basic; public Io Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int type, IntPtr info, uint length);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    internal static IntPtr Create() { IntPtr job = CreateJobObject(IntPtr.Zero, null); if (job == IntPtr.Zero) throw new InvalidOperationException("Job Object indisponível."); var limits = new Extended(); limits.Basic.Flags = 0x2000; int size = Marshal.SizeOf(limits); IntPtr pointer = Marshal.AllocHGlobal(size); try { Marshal.StructureToPtr(limits, pointer, false); if (!SetInformationJobObject(job, 9, pointer, (uint)size)) { CloseHandle(job); throw new InvalidOperationException("Falha no supervisor de processos."); } } finally { Marshal.FreeHGlobal(pointer); } return job; }
    internal static bool Assign(IntPtr job, IntPtr process) { return AssignProcessToJobObject(job, process); }
    internal static void Close(IntPtr job) { CloseHandle(job); }
}
