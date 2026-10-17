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
using Microsoft.Win32;
using System.Threading.Tasks;

internal static class Program {
    internal static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    internal static string Panel { get { return "http://127.0.0.1:" + PortSettings.Load().Panel + "/"; } }
    [STAThread]
    private static void Main(string[] args) {
        if (Array.IndexOf(args, "--restart-rgb") >= 0) {
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            if (args[0] != "--restart-rgb" || !(args.Length == 1 || (args.Length == 2 && RecoveryLink(args[1])))) { MessageBox.Show(L.T("Comando de recuperação inválido."), "Nexus RGB"); return; }
            if (!RecoveryInstalled()) { MessageBox.Show(L.T("Use o Nexus instalado em Program Files\\Nexus RGB para recuperar os serviços."), "Nexus RGB"); return; }
            if (!new System.Security.Principal.WindowsPrincipal(System.Security.Principal.WindowsIdentity.GetCurrent()).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator)) { RestartServices(); return; }
            Application.Run(new RecoveryDialog()); return;
        }
        if (Array.IndexOf(args, "--configure-ports") >= 0) { Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false); Application.Run(new PortDialog()); return; }
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
        try {
        if (!PanelReady()) { MessageBox.Show(L.T("O painel Nexus ainda não respondeu no endereço configurado. Aguarde a inicialização ou use Configurar portas no ícone perto do relógio se houver conflito."), "Nexus RGB", MessageBoxButtons.OK, MessageBoxIcon.Warning); return; }
        // The browser renders local HTML; it never receives native privileges.
        string[] paths = { Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe") };
        foreach (string path in paths) if (File.Exists(path)) { Process.Start(new ProcessStartInfo(path, "--app=" + Panel) { UseShellExecute = true }); return; }
        Process.Start(new ProcessStartInfo(Panel) { UseShellExecute = true });
        } catch (Exception error) { MessageBox.Show(error.Message + L.T("\nAbra Configurar portas no ícone do Nexus."), "Nexus RGB", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    }
    internal static void ConfigurePorts() {
        try { Process.Start(new ProcessStartInfo(Path.Combine(Root, "NexusRGB.exe"), "--configure-ports") { UseShellExecute = true, Verb = "runas" }); }
        catch (System.ComponentModel.Win32Exception error) { if (error.NativeErrorCode != 1223) MessageBox.Show(error.Message, "Nexus RGB"); }
    }
    internal static bool RecoveryLink(string value) { return string.Equals(value, "nexusrgb://restart", StringComparison.OrdinalIgnoreCase) || string.Equals(value, "nexusrgb://restart/", StringComparison.OrdinalIgnoreCase); }
    internal static bool RecoveryInstalled() {
        string root = Path.GetFullPath(Root).TrimEnd(Path.DirectorySeparatorChar);
        return string.Equals(root, Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Nexus RGB"), StringComparison.OrdinalIgnoreCase) && (File.GetAttributes(root) & FileAttributes.ReparsePoint) == 0 && File.Exists(Path.Combine(root, @"scripts\restart-services.ps1"));
    }
    internal static void RestartServices() {
        if (!RecoveryInstalled()) { MessageBox.Show(L.T("Instale ou atualize o Nexus para recuperar os serviços."), "Nexus RGB"); return; }
        try { Process.Start(new ProcessStartInfo(Path.Combine(Root, "NexusRGB.exe"), "--restart-rgb") { UseShellExecute = true, Verb = "runas" }); }
        catch (System.ComponentModel.Win32Exception error) { if (error.NativeErrorCode != 1223) MessageBox.Show(error.Message, "Nexus RGB"); }
    }
    internal static string ReadHealth() {
        try {
            var request = (HttpWebRequest)WebRequest.Create(Panel + "api/health"); request.Proxy = null; request.Timeout = 1000; request.ReadWriteTimeout = 1000;
            using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) { char[] buffer = new char[1024]; int count = reader.Read(buffer, 0, buffer.Length); return new string(buffer, 0, count); }
        } catch { return ""; }
    }
    internal static bool PanelReady() { return ReadHealth().Contains("\"application\":\"nexus-rgb\""); }
}
internal sealed class RecoveryDialog : Form {
    private readonly Label status;
    private readonly Button close;
    private bool busy = true;
    internal RecoveryDialog() {
        Text = L.T("Nexus RGB — Reiniciar controlador"); ClientSize = new Size(520, 260); FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen; Font = new Font("Segoe UI", 10F);
        Controls.Add(new Label { Left = 22, Top = 20, Width = 475, Height = 30, Text = L.T("Reiniciando Nexus e OpenRGB"), Font = new Font("Segoe UI", 14F, FontStyle.Bold) });
        status = new Label { Left = 22, Top = 65, Width = 475, Height = 125, Text = L.T("Aguarde. As luzes podem parar por alguns segundos.\nPerfis, posições, efeitos importados e configurações serão preservados.") }; Controls.Add(status);
        close = new Button { Left = 367, Top = 210, Width = 130, Height = 30, Text = L.T("Fechar"), Enabled = false }; close.Click += (s,e) => Close(); Controls.Add(close);
        FormClosing += (s,e) => { if (busy) e.Cancel = true; };
        Shown += async (s,e) => {
            var progress = new System.Windows.Forms.Timer { Interval = 750 };
            bool polling = false;
            progress.Tick += async (ts, te) => {
                if (!busy || polling) return;
                polling = true;
                try {
                    string health = await Task.Run(() => Program.ReadHealth());
                    if (!busy || !health.Contains("\"application\":\"nexus-rgb\"")) return;
                    status.Text = health.Contains("\"connected\":true")
                        ? L.T("Painel pronto e OpenRGB conectado. Detectando componentes RGB…\nPerfis, posições, efeitos importados e configurações serão preservados.")
                        : L.T("Painel pronto. Aguardando conexão do OpenRGB…\nPerfis, posições, efeitos importados e configurações serão preservados.");
                } finally { polling = false; }
            };
            progress.Start();
            try {
                var result = await Task.Run(() => {
                    string shell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe");
                    var info = new ProcessStartInfo(shell, "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + Path.Combine(Program.Root, @"scripts\restart-services.ps1") + "\"") { WorkingDirectory = Program.Root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
                    using (var process = Process.Start(info)) {
                        var output = process.StandardOutput.ReadToEndAsync(); var errors = process.StandardError.ReadToEndAsync();
                        if (!process.WaitForExit(180000)) { process.Kill(); throw new InvalidOperationException(L.T("A recuperação demorou além do limite. Confira os serviços e diagnósticos.")); }
                        return new { Code = process.ExitCode, Message = output.Result + errors.Result };
                    }
                });
                status.Text = (result.Code == 0 ? L.T("Concluído.\n") : L.T("Não foi possível concluir.\n")) + result.Message.Trim() + L.T("\nRecarregue o painel para conferir o estado atual.");
            } catch (Exception error) { status.Text = L.T("Não foi possível concluir.\n") + error.Message; }
            finally { busy = false; progress.Stop(); progress.Dispose(); close.Enabled = true; }
        };
    }
}
internal sealed class PortSettings {
    internal int Panel = 5050, SDK = 6743, Alexa = 80;
    internal static PortSettings Load() {
        var value = new PortSettings();
        using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\NexusRGB")) {
            if (key != null) { value.Panel = Read(key, "PanelPort", value.Panel); value.SDK = Read(key, "SDKPort", value.SDK); value.Alexa = Read(key, "AlexaPort", value.Alexa); }
        }
        value.Validate(); return value;
    }
    private static int Read(RegistryKey key, string name, int fallback) { object value = key.GetValue(name, null); if (value == null) return fallback; if (!(value is int)) throw new InvalidDataException(L.T("Porta inválida no registro: ") + name); return (int)value; }
    internal void Validate() { if (Panel < 1024 || Panel > 65535 || SDK < 1024 || SDK > 65535 || Alexa < 1 || Alexa > 65535 || Panel == SDK || Panel == Alexa || SDK == Alexa) throw new InvalidDataException(L.T("Use portas diferentes. Painel/SDK: 1024 a 65535. Alexa: 1 a 65535.")); }
}
internal sealed class PortDialog : Form {
    private readonly NumericUpDown panel, sdk, alexa;
    private readonly Button apply;
    private bool busy;
    internal PortDialog() {
        Text = L.T("Nexus RGB — Configurar portas"); ClientSize = new Size(520, 345); FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9F);
        PortSettings current;
        try { current = PortSettings.Load(); } catch { current = new PortSettings(); }
        var intro = new Label { Left = 20, Top = 15, Width = 480, Height = 42, Text = L.T("Escolha portas diferentes das usadas por outros aplicativos.\nOs links e o firewall do Nexus serão atualizados ao aplicar.") }; Controls.Add(intro);
        panel = Field(L.T("Painel web / celular"), 70, current.Panel, 1024, true);
        sdk = Field(L.T("SDK OpenRGB (somente neste PC)"), 115, current.SDK, 1024, true);
        alexa = Field(L.T("Ponte Alexa (recomendado: 80)"), 160, current.Alexa, 1, false);
        Controls.Add(new Label { Left = 20, Top = 207, Width = 480, Height = 60, Text = L.T("Descoberta Alexa: UDP 1900, definida pelo protocolo.\nOutra porta HTTP pode não funcionar com alguns Echos.\nAo mudar o painel, atualize os favoritos e o link do celular.") });
        apply = new Button { Left = 330, Top = 290, Width = 170, Height = 32, Text = L.T("Aplicar e reiniciar Nexus") }; Controls.Add(apply);
        apply.Click += async (s, e) => {
            var value = new PortSettings { Panel = (int)panel.Value, SDK = (int)sdk.Value, Alexa = (int)alexa.Value };
            try {
                value.Validate(); busy = true; apply.Enabled = false;
                DateTime started = DateTime.UtcNow;
                int result = await Task.Run(() => {
                    var info = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"), "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + Path.Combine(Program.Root, @"scripts\configure-ports.ps1") + "\" -PanelPort " + value.Panel + " -SDKPort " + value.SDK + " -AlexaPort " + value.Alexa) { WorkingDirectory = Program.Root, UseShellExecute = false, CreateNoWindow = true };
                    using (var process = Process.Start(info)) { process.WaitForExit(); return process.ExitCode; }
                });
                if (result != 0) {
                    string log = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "NexusRGB", "ports-error.log");
                    string detail = File.Exists(log) && File.GetLastWriteTimeUtc(log) >= started ? File.ReadAllText(log) : L.T("Consulte ProgramData\\NexusRGB\\ports-error.log.");
                    throw new InvalidOperationException(L.T("A alteração não foi aplicada.\n") + detail.Substring(0, Math.Min(detail.Length, 1500)));
                }
                MessageBox.Show(L.T("Portas atualizadas. Abra o Nexus pelo ícone para usar o novo endereço."), "Nexus RGB");
            } catch (Exception error) { MessageBox.Show(error.Message, "Nexus RGB", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
            finally { busy = false; apply.Enabled = true; }
        };
        FormClosing += (s, e) => { if (busy) e.Cancel = true; };
    }
    private NumericUpDown Field(string title, int top, int port, int minimum, bool suggest) {
        Controls.Add(new Label { Left = 20, Top = top + 5, Width = 265, Height = 25, Text = title });
        var field = new NumericUpDown { Left = 288, Top = top, Width = 88, Minimum = minimum, Maximum = 65535, Value = port }; Controls.Add(field);
        if (suggest) {
            var button = new Button { Left = 385, Top = top - 1, Width = 115, Height = 28, Text = L.T("Buscar livre") }; Controls.Add(button);
            button.Click += (s, e) => {
                for (int candidate = (int)field.Value; candidate <= Math.Min(65535, (int)field.Value + 200); candidate++) {
                    if ((panel != null && field != panel && candidate == (int)panel.Value) || (sdk != null && field != sdk && candidate == (int)sdk.Value) || (alexa != null && candidate == (int)alexa.Value)) continue;
                    var listener = new System.Net.Sockets.TcpListener(IPAddress.Any, candidate);
                    try { listener.ExclusiveAddressUse = true; listener.Start(); field.Value = candidate; return; } catch (System.Net.Sockets.SocketException) {} finally { listener.Stop(); }
                }
                MessageBox.Show(L.T("Não foi encontrada uma porta livre próxima. Escolha outro número."), "Nexus RGB");
            };
        }
        return field;
    }
}
internal sealed class Tray : ApplicationContext {
    private sealed class TrayMessageWindow : NativeWindow, IDisposable {
        private readonly Tray tray;
        internal TrayMessageWindow(Tray tray) {
            this.tray = tray;
            CreateParams cp = new CreateParams {
                Caption = "NexusRGB_TrayMessageWindow",
                Style = 0,
                Width = 0,
                Height = 0,
                X = -2000,
                Y = -2000
            };
            CreateHandle(cp);
        }
        protected override void WndProc(ref Message m) {
            const int WM_CLOSE = 0x0010;
            const int WM_QUERYENDSESSION = 0x0011;
            const int WM_ENDSESSION = 0x0016;
            if (m.Msg == WM_QUERYENDSESSION) {
                m.Result = (IntPtr)1;
                return;
            }
            if (m.Msg == WM_ENDSESSION) {
                if (m.WParam != IntPtr.Zero) {
                    tray.ExitThread();
                }
                m.Result = IntPtr.Zero;
                return;
            }
            if (m.Msg == WM_CLOSE) {
                tray.ExitThread();
                m.Result = IntPtr.Zero;
                return;
            }
            base.WndProc(ref m);
        }
        public void Dispose() {
            DestroyHandle();
        }
    }

    private readonly NotifyIcon icon;
    private readonly System.Windows.Forms.Timer timer;
    private readonly ToolStripMenuItem status;
    private readonly EventWaitHandle exitEvent;
    private readonly RegisteredWaitHandle waitHandle;
    private readonly TrayMessageWindow messageWindow;
    private bool checking;
    private bool exiting;

    internal static string ComputePathHash(string path) {
        using (var sha = System.Security.Cryptography.SHA256.Create()) {
            string norm = Path.GetFullPath(path).TrimEnd('\\').ToUpperInvariant();
            byte[] bytes = Encoding.UTF8.GetBytes(norm);
            byte[] hash = sha.ComputeHash(bytes);
            var sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) sb.Append(hash[i].ToString("X2"));
            return sb.ToString();
        }
    }

    internal Tray(bool open) {
        messageWindow = new TrayMessageWindow(this);
        string eventName = "Local\\NexusRGB.Tray.Exit." + ComputePathHash(Program.Root);
        bool exitCreated;
        try {
            var security = new System.Security.AccessControl.EventWaitHandleSecurity();
            security.AddAccessRule(new System.Security.AccessControl.EventWaitHandleAccessRule(
                new System.Security.Principal.SecurityIdentifier(System.Security.Principal.WellKnownSidType.AuthenticatedUserSid, null),
                System.Security.AccessControl.EventWaitHandleRights.FullControl,
                System.Security.AccessControl.AccessControlType.Allow
            ));
            exitEvent = new EventWaitHandle(false, EventResetMode.AutoReset, eventName, out exitCreated, security);
        } catch {
            exitEvent = new EventWaitHandle(false, EventResetMode.AutoReset, eventName, out exitCreated);
        }
        SynchronizationContext uiContext = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        waitHandle = ThreadPool.RegisterWaitForSingleObject(exitEvent, (state, timedOut) => {
            if (!exiting) {
                uiContext.Post(_ => ExitThread(), null);
            }
        }, null, -1, false);
        var menu = new ContextMenuStrip();
        status = new ToolStripMenuItem(L.T("Nexus RGB: verificando serviço")) { Enabled = false }; menu.Items.Add(status);
        menu.Items.Add(L.T("Abrir Nexus RGB"), null, (s, e) => Program.OpenPanel());
        menu.Items.Add(L.T("Copiar link para o celular"), null, (s, e) => CopyLink());
        menu.Items.Add(L.T("Configurar portas…"), null, (s, e) => Program.ConfigurePorts());
        menu.Items.Add(L.T("Reiniciar Nexus e OpenRGB…"), null, (s, e) => Program.RestartServices());
        menu.Items.Add(L.T("Abrir pasta de diagnósticos"), null, (s, e) => Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "NexusRGB", "app")) { UseShellExecute = true }));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(L.T("Fechar ícone (manter as luzes)"), null, (s, e) => ExitThread());
        var languages = new ToolStripMenuItem("Idioma / Language");
        var portuguese = new ToolStripMenuItem("Português (Brasil)");
        var english = new ToolStripMenuItem("English");
        Action refreshLanguage = () => {
            string[] labels = { L.T("Abrir Nexus RGB"), L.T("Copiar link para o celular"), L.T("Configurar portas…"), L.T("Reiniciar Nexus e OpenRGB…"), L.T("Abrir pasta de diagnósticos") };
            for (int i = 0; i < labels.Length; i++) menu.Items[i + 1].Text = L.T(labels[i]);
            menu.Items[7].Text = L.T("Fechar ícone (manter as luzes)");
            portuguese.Checked = L.Current == "pt-BR"; english.Checked = !portuguese.Checked;
            CheckStatus();
        };
        portuguese.Click += (s,e) => { L.Select("pt-BR"); refreshLanguage(); };
        english.Click += (s,e) => { L.Select("en"); refreshLanguage(); };
        portuguese.Checked = L.Current == "pt-BR"; english.Checked = !portuguese.Checked;
        languages.DropDownItems.Add(portuguese); languages.DropDownItems.Add(english); menu.Items.Add(languages);
        string ico = Path.Combine(Program.Root, "app.ico");
        icon = new NotifyIcon { Icon = File.Exists(ico) ? new Icon(ico) : SystemIcons.Application, Text = "Nexus RGB", ContextMenuStrip = menu, Visible = true };
        icon.DoubleClick += (s, e) => Program.OpenPanel();
        timer = new System.Windows.Forms.Timer { Interval = 5000 }; timer.Tick += (s, e) => CheckStatus(); timer.Start();
        CheckStatus(); if (open) Program.OpenPanel();
    }
    private async void CheckStatus() {
        if (checking) return; checking = true;
        try { using (var service = new ServiceController("NexusRGB")) { if (service.Status != ServiceControllerStatus.Running) status.Text = L.T("Nexus RGB: serviço parado"); else { int port = PortSettings.Load().Panel; bool ready = await Task.Run(() => Program.PanelReady()); if (exiting) return; status.Text = ready ? L.T("Nexus RGB: painel ativo na porta ") + port : L.T("Nexus RGB: painel indisponível na porta ") + port; } } }
        catch { if (!exiting) status.Text = L.T("Nexus RGB: confira serviços e portas"); }
        finally { checking = false; }
    }
    private static bool IsPrivate(byte[] ip) {
        return ip != null && ip.Length == 4 && (ip[0] == 10 || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] == 192 && ip[1] == 168));
    }
    private void CopyLink() {
        int port;
        try { port = PortSettings.Load().Panel; } catch (Exception error) { MessageBox.Show(error.Message, "Nexus RGB"); return; }
        string health = Program.ReadHealth();
        int marker = health.IndexOf("\"lanUrl\":\"http://", StringComparison.Ordinal);
        if (marker >= 0) {
            int start = marker + 10, end = health.IndexOf('"', start);
            if (end > start) {
                Clipboard.SetText(health.Substring(start, end - start));
                icon.ShowBalloonTip(3000, L.T("Link copiado"), L.T("Abra este endereço no celular conectado ao mesmo Wi-Fi."), ToolTipIcon.Info);
                return;
            }
        }
        string fallback = null;
        foreach (var adapter in NetworkInterface.GetAllNetworkInterfaces()) {
            if (adapter.OperationalStatus != OperationalStatus.Up || adapter.NetworkInterfaceType == NetworkInterfaceType.Loopback || adapter.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
            string name = adapter.Name.ToLowerInvariant();
            if (name.Contains("vpn") || name.Contains("tailscale") || name.Contains("hamachi") || name.Contains("radmin") || name.Contains("zerotier") || name.Contains("wireguard") || name.Contains("tunnel") || name.Contains("wsl") || name.Contains("default switch") || name.Contains("docker") || name.Contains("vboxnet") || name.Contains("vmnet") || name.Contains("host-only") || name.Contains("wintun")) continue;
            bool isVirtual = name.Contains("virtual") || name.Contains("vethernet") || name.Contains("hyper-v");
            var props = adapter.GetIPProperties();
            bool hasGateway = false;
            foreach (var gw in props.GatewayAddresses) if (IsPrivate(gw.Address.GetAddressBytes())) { hasGateway = true; break; }
            if (isVirtual && !hasGateway) continue;
            foreach (var address in props.UnicastAddresses) {
                if (IsPrivate(address.Address.GetAddressBytes())) {
                    string candidate = "http://" + address.Address + ":" + port + "/";
                    if (hasGateway && !isVirtual) { Clipboard.SetText(candidate); icon.ShowBalloonTip(3000, L.T("Link copiado"), L.T("Abra este endereço no celular conectado ao mesmo Wi-Fi."), ToolTipIcon.Info); return; }
                    if (fallback == null || hasGateway) fallback = candidate;
                }
            }
        }
        if (fallback != null) { Clipboard.SetText(fallback); icon.ShowBalloonTip(3000, L.T("Link copiado"), L.T("Abra este endereço no celular conectado ao mesmo Wi-Fi."), ToolTipIcon.Info); return; }
        icon.ShowBalloonTip(3000, L.T("Rede indisponível"), L.T("Conecte o PC a uma rede Wi-Fi ou Ethernet privada."), ToolTipIcon.Warning);
    }
    protected override void ExitThreadCore() {
        exiting = true;
        if (waitHandle != null) waitHandle.Unregister(null);
        if (exitEvent != null) exitEvent.Dispose();
        if (messageWindow != null) messageWindow.Dispose();
        timer.Stop(); timer.Dispose(); icon.Visible = false; icon.Dispose(); base.ExitThreadCore();
    }
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
        if (!Directory.Exists(data)) throw new DirectoryNotFoundException(L.T("Use o instalador para criar a pasta do serviço."));
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
                var ports = PortSettings.Load();
                string exe = Path.Combine(Program.Root, hardware ? "openrgb\\OpenRGB.exe" : "runtime\\node.exe");
                string arguments = hardware ? "--server --server-host 127.0.0.1 --server-port " + ports.SDK + " --noautoconnect --config \"" + data + "\"" : "\"" + Path.Combine(Program.Root, "server", "index.js") + "\"";
                var info = new ProcessStartInfo(exe, arguments) { WorkingDirectory = Program.Root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
                if (!hardware) { info.EnvironmentVariables["NEXUS_DATA_DIR"] = data; info.EnvironmentVariables["NEXUS_PORT"] = ports.Panel.ToString(); info.EnvironmentVariables["NEXUS_RGB_PORT"] = ports.SDK.ToString(); info.EnvironmentVariables["NEXUS_ALEXA_PORT"] = ports.Alexa.ToString(); info.EnvironmentVariables["NEXUS_SUPERVISED"] = "1"; info.EnvironmentVariables["NODE_ENV"] = "production"; info.EnvironmentVariables.Remove("NODE_OPTIONS"); info.EnvironmentVariables.Remove("NODE_PATH"); }
                child = new Process { StartInfo = info }; child.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); }; child.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                child.Start(); if (!Job.Assign(job, child.Handle)) { child.Kill(); throw new InvalidOperationException(L.T("Não foi possível supervisionar o processo.")); }
                child.BeginOutputReadLine(); child.BeginErrorReadLine(); Log("Processo iniciado: " + child.Id);
            } catch (Exception error) { Log("Falha ao iniciar: " + error.Message); if (child != null) { child.Dispose(); child = null; } nextStart = DateTime.UtcNow.AddSeconds(15); }
        }
    }
    protected override void OnStop() {
        Process running; IntPtr currentJob;
        lock (gate) { stopping = true; if (timer != null) { timer.Dispose(); timer = null; } running = child; child = null; currentJob = job; job = IntPtr.Zero; }
        if (running != null) {
            try {
                if (!running.HasExited) {
                    try { running.StandardInput.WriteLine("shutdown"); running.StandardInput.Close(); } catch {}
                    try { running.CloseMainWindow(); } catch {}
                    if (running.WaitForExit(hardware ? 1500 : 4000)) Log("Processo encerrou normalmente.");
                    else Log("Prazo de encerramento esgotado; aplicando recuperação forçada.");
                }
            } catch {}
            finally { try { running.Dispose(); } catch {} }
        }
        if (currentJob != IntPtr.Zero) Job.Close(currentJob);
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
    internal static IntPtr Create() { IntPtr job = CreateJobObject(IntPtr.Zero, null); if (job == IntPtr.Zero) throw new InvalidOperationException(L.T("Job Object indisponível.")); var limits = new Extended(); limits.Basic.Flags = 0x2000; int size = Marshal.SizeOf(limits); IntPtr pointer = Marshal.AllocHGlobal(size); try { Marshal.StructureToPtr(limits, pointer, false); if (!SetInformationJobObject(job, 9, pointer, (uint)size)) { CloseHandle(job); throw new InvalidOperationException(L.T("Falha no supervisor de processos.")); } } finally { Marshal.FreeHGlobal(pointer); } return job; }
    internal static bool Assign(IntPtr job, IntPtr process) { return AssignProcessToJobObject(job, process); }
    internal static void Close(IntPtr job) { CloseHandle(job); }
}
