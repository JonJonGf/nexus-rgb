// Nexus RGB development cooling adapter. No hardware is opened until "open".
// LibreHardwareMonitor is an unmodified, separately licensed dependency.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using LibreHardwareMonitor.Hardware;

internal interface ICoolingBackend : IDisposable {
    object Sample();
    void Apply(Dictionary<string, object>[] values);
    void Release();
}
internal sealed class CoolingHardware : ICoolingBackend {
    private readonly Computer computer;
    private readonly Dictionary<string, IControl> controls = new Dictionary<string, IControl>();
    // Keep the exact leased handle even if a later sample/rediscovery fails.
    private readonly Dictionary<string, IControl> owned = new Dictionary<string, IControl>();
    internal CoolingHardware() {
        if (!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))
            throw new InvalidOperationException("O auxiliar de ventilação precisa de administrador.");
        // No RAM/SPD, storage, network or generic USB-controller polling.
        computer = new Computer { IsCpuEnabled = true, IsGpuEnabled = true, IsMotherboardEnabled = true,
            IsMemoryEnabled = false, IsStorageEnabled = false, IsNetworkEnabled = false, IsControllerEnabled = false };
        try { computer.Open(); } catch { computer.Close(); throw; }
    }
    private IEnumerable<IHardware> All(IHardware item) {
        yield return item;
        foreach (var child in item.SubHardware) foreach (var value in All(child)) yield return value;
    }
    public object Sample() {
        var sensors = new List<object>(); var fans = new List<object>(); var channels = new List<object>();
        controls.Clear();
        foreach (var hardware in computer.Hardware.SelectMany(All)) {
            hardware.Update();
            foreach (var sensor in hardware.Sensors) {
                string id = sensor.Identifier.ToString();
                string name = (hardware.Name + " · " + sensor.Name);
                if (name.Length > 160) name = name.Substring(0, 160);
                object value = sensor.Value.HasValue && !float.IsNaN(sensor.Value.Value) && !float.IsInfinity(sensor.Value.Value) ? (object)sensor.Value.Value : null;
                if (sensor.SensorType == SensorType.Temperature && sensors.Count < 128)
                    sensors.Add(new { id = id, name = name, value = value });
                if (sensor.SensorType == SensorType.Fan && fans.Count < 128)
                    fans.Add(new { id = id, name = name, value = value });
                bool supported = hardware.HardwareType == HardwareType.SuperIO || hardware.HardwareType == HardwareType.GpuAmd || hardware.HardwareType == HardwareType.GpuNvidia;
                if (supported && sensor.SensorType == SensorType.Control && sensor.Control != null && controls.Count < 64) {
                    var control = sensor.Control;
                    if (control.MinSoftwareValue < 0 || control.MaxSoftwareValue > 100 || control.MinSoftwareValue >= control.MaxSoftwareValue) continue;
                    string key = control.Identifier.ToString(); controls[key] = control;
                    channels.Add(new { id = key, name = name, min = control.MinSoftwareValue, max = control.MaxSoftwareValue });
                }
            }
        }
        return new { at = CoolingProgram.Now(), simulated = false, sensors = sensors, controls = channels, fans = fans };
    }
    public void Apply(Dictionary<string, object>[] values) {
        // Validate the complete batch before any hardware write.
        foreach (var item in values) {
            string id = Convert.ToString(item["id"], CultureInfo.InvariantCulture);
            double percent = Convert.ToDouble(item["percent"], CultureInfo.InvariantCulture);
            if (!controls.ContainsKey(id) || double.IsNaN(percent) || double.IsInfinity(percent) || percent < Math.Max(20, controls[id].MinSoftwareValue) || percent > controls[id].MaxSoftwareValue)
                throw new InvalidOperationException("Canal ou percentual de ventilação inválido.");
        }
        try {
            foreach (var item in values) {
                string id = (string)item["id"]; owned[id] = controls[id];
                controls[id].SetSoftware(Convert.ToSingle(item["percent"], CultureInfo.InvariantCulture));
            }
        } catch { Release(); throw; }
    }
    public void Release() {
        bool failed = false;
        foreach (string id in owned.Keys.ToArray()) {
            try { owned[id].SetDefault(); owned.Remove(id); }
            catch { failed = true; }
        }
        if (failed) throw new InvalidOperationException("Não foi possível confirmar a liberação do controle automático.");
    }
    public void Dispose() { try { Release(); } finally { computer.Close(); } }
}
internal sealed class CoolingFixture : ICoolingBackend {
    private readonly Dictionary<string, double> values = new Dictionary<string, double>();
    internal CoolingFixture() {
        // Load the real library into the fixture process, but never create/open Computer.
        GC.KeepAlive(typeof(Computer));
    }
    public object Sample() {
        var controls = Enumerable.Range(1, 6).Select(i => new { id = "fan-" + i, name = "Fan " + i + " (simulada)", min = 0, max = 100 }).ToArray();
        var fans = Enumerable.Range(1, 6).Select(i => new { id = "rpm-" + i, name = "RPM " + i + " (simulada)", value = values.ContainsKey("fan-" + i) ? values["fan-" + i] * 20 : 1200 }).ToArray();
        return new { at = CoolingProgram.Now(), simulated = true, sensors = new[] { new { id = "cpu", name = "CPU simulada", value = 60 }, new { id = "gpu", name = "GPU simulada", value = 55 } }, controls = controls, fans = fans };
    }
    public void Apply(Dictionary<string, object>[] items) {
        foreach (var item in items) { string id = (string)item["id"]; double value = Convert.ToDouble(item["percent"]); if (!Regex.IsMatch(id, "^fan-[1-6]$") || value < 20 || value > 100 || double.IsNaN(value) || double.IsInfinity(value)) throw new InvalidOperationException("Comando simulado inválido."); }
        foreach (var item in items) values[(string)item["id"]] = Convert.ToDouble(item["percent"]);
    }
    public void Release() { values.Clear(); }
    public void Dispose() { Release(); }
}
internal static class CoolingProgram {
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 262144, RecursionLimit = 16 };
    private static readonly object Gate = new object();
    private static ICoolingBackend backend;
    private static long lastSeen;
    private static bool stopping;
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out uint clientPid);
    internal static long Now() { return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds; }
    private static string ReadLine(TextReader input) {
        var text = new StringBuilder(); int c;
        while ((c = input.Read()) >= 0) { if (c == '\n') return text.ToString(); if (c != '\r') text.Append((char)c); if (text.Length > 32768) throw new InvalidDataException("Comando acima do limite."); }
        return text.Length == 0 ? null : text.ToString();
    }
    private static object Sample() {
        var sample = backend.Sample();
        var data = sample.GetType().GetProperties().ToDictionary(p => p.Name, p => p.GetValue(sample, null));
        using (var process = Process.GetCurrentProcess()) {
            data["resources"] = new { pid = process.Id, role = "cooling-helper", start = process.StartTime.ToUniversalTime().Ticks.ToString(CultureInfo.InvariantCulture),
                cpuTicks = process.TotalProcessorTime.Ticks.ToString(CultureInfo.InvariantCulture), memoryBytes = process.WorkingSet64 };
        }
        return data;
    }
    public static int Main(string[] args) {
        bool fixture = args.Contains("--fixture"); string pipeName = null; int parentId = 0;
        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "--fixture" || args[i] == "--hardware") continue;
            if (args[i] == "--pipe" && i + 1 < args.Length) pipeName = args[++i];
            else if (args[i] == "--parent" && i + 1 < args.Length) { if (!int.TryParse(args[++i], out parentId) || parentId <= 0) return 2; }
            else return 2;
        }
        if (fixture == args.Contains("--hardware") || parentId == 0 || !fixture && pipeName == null) return 2;
        Process parent; try { parent = Process.GetProcessById(parentId); var ignored = parent.StartTime; } catch { return 2; }
        NamedPipeServerStream pipe = null; Timer watchdog = null;
        try {
            TextReader reader; TextWriter writer;
            if (pipeName != null) {
                if (!Regex.IsMatch(pipeName, @"^NexusRGB\.Cooling\.Dev\.[a-f0-9]{32}$")) return 2;
                var acl = new PipeSecurity();
                acl.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
                acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
                if(WindowsIdentity.GetCurrent().IsSystem)acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalServiceSid,null),PipeAccessRights.ReadWrite|PipeAccessRights.CreateNewInstance|PipeAccessRights.Synchronize,AccessControlType.Allow));
                acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid, null), PipeAccessRights.FullControl, AccessControlType.Deny));
                pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 65536, 65536, acl);
                var waiting = pipe.BeginWaitForConnection(null, null);
                if (!waiting.AsyncWaitHandle.WaitOne(60000)) return 3;
                pipe.EndWaitForConnection(waiting);
                uint actualPid;
                if (!GetNamedPipeClientProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out actualPid) || actualPid != (uint)parentId) return 3;
                reader = new StreamReader(pipe, new UTF8Encoding(false), false, 4096, true);
                writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true) { AutoFlush = true };
            } else {
                Console.InputEncoding = new UTF8Encoding(false); Console.OutputEncoding = new UTF8Encoding(false);
                reader = Console.In; writer = Console.Out;
            }
            lastSeen = Now();
            watchdog = new Timer(delegate {
                try {
                    if (!parent.HasExited && Now() - Interlocked.Read(ref lastSeen) < 5000) return;
                    lock (Gate) { if (stopping) return; stopping = true; if (backend != null) backend.Release(); }
                    if (pipe != null) pipe.Dispose(); else Environment.Exit(0);
                } catch { if (pipe != null) try { pipe.Dispose(); } catch {} }
            }, null, 1000, 1000);
            writer.WriteLine(Json.Serialize(new { status = "ready", simulated = fixture, privileged = new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator), pid = Process.GetCurrentProcess().Id }));
            string line;
            while (!stopping && (line = ReadLine(reader)) != null) {
                object response; object requestId = null; bool shutdown = false;
                try {
                    var request = Json.DeserializeObject(line) as Dictionary<string, object>;
                    if (request == null || !request.ContainsKey("id") || !request.ContainsKey("action")) throw new InvalidDataException();
                    requestId = request["id"]; string action = request["action"] as string;
                    Interlocked.Exchange(ref lastSeen, Now());
                    lock (Gate) {
                        if (stopping) break;
                        if (action == "open") { if (backend == null) backend = fixture ? (ICoolingBackend)new CoolingFixture() : new CoolingHardware(); response = Sample(); }
                        else if (action == "sample" && backend != null) response = Sample();
                        else if (action == "apply" && backend != null) {
                            var array = request["values"] as object[];
                            if (array == null || array.Length == 0 || array.Length > 32) throw new InvalidDataException();
                            var values = array.Select(item => item as Dictionary<string, object>).ToArray();
                            if (values.Any(item => item == null || item.Count != 2 || !item.ContainsKey("id") || !(item["id"] is string) || !item.ContainsKey("percent") || !(item["percent"] is int || item["percent"] is decimal || item["percent"] is double))) throw new InvalidDataException();
                            if (values.Select(item => (string)item["id"]).Distinct().Count() != values.Length) throw new InvalidDataException();
                            backend.Apply(values); response = new { applied = values };
                        } else if (action == "release" || action == "shutdown") { if (backend != null) backend.Release(); response = new { released = true }; shutdown = action == "shutdown"; }
                        else throw new InvalidDataException();
                    }
                    writer.WriteLine(Json.Serialize(new { id = requestId, status = "ok", data = response }));
                } catch (Exception error) {
                    lock (Gate) { if (backend != null) try { backend.Release(); } catch {} }
                    string message = error is InvalidOperationException ? error.Message : "Falha no auxiliar de ventilação.";
                    writer.WriteLine(Json.Serialize(new { id = requestId, status = "error", message = message }));
                }
                if (shutdown) break;
            }
            return 0;
        } catch { return 1; }
        finally {
            stopping = true; if (watchdog != null) watchdog.Dispose();
            lock (Gate) { if (backend != null) try { backend.Dispose(); } catch {} }
            if (pipe != null) pipe.Dispose(); parent.Dispose();
        }
    }
}
