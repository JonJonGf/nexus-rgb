'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
if (process.platform !== 'win32') throw Error('Este teste exige Windows.');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-supervisor-'));
const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
function compile(args) {
  const result = spawnSync(compiler, ['/nologo', '/codepage:65001', ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
try {
  // Only the ProgramData path is redirected. Worker and Job logic are real.
  const native = fs.readFileSync(path.join(root, 'native', 'NexusRGB.cs'), 'utf8')
    .replaceAll('Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData)', 'WorkerFixture.DataRoot');
  const fixture = String.raw`
internal static class WorkerFixture {
    internal static readonly string DataRoot = System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, "data");
    private static void Main() {
        if (Program.RecoveryInstalled()) throw new System.Exception("Recovery accepted an unregistered executable.");
        if (!Program.RecoveryLink("nexusrgb://restart") || !Program.RecoveryLink("nexusrgb://restart/")) throw new System.Exception("Recovery URL rejected.");
        foreach (string input in new string[] { "nexusrgb://restart?file=x", "nexusrgb://restart/--service", "nexusrgb://restart\" --service", "https://example.com", "nexusrgb://delete" }) if (Program.RecoveryLink(input)) throw new System.Exception("Arbitrary recovery URL accepted.");
        string data = System.IO.Path.Combine(DataRoot, "NexusRGB", "app");
        System.IO.Directory.CreateDirectory(data);
        var worker = new Worker(false);
        var start = typeof(Worker).GetMethod("OnStart", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var stop = typeof(Worker).GetMethod("OnStop", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        bool started = false;
        try {
            start.Invoke(worker, new object[] { new string[0] }); started = true;
            var deadline = System.DateTime.UtcNow.AddSeconds(20);
            string stable = System.IO.Path.Combine(data, "stable-pid");
            while (!System.IO.File.Exists(stable) && System.DateTime.UtcNow < deadline) System.Threading.Thread.Sleep(100);
            if (!System.IO.File.Exists(stable)) throw new System.Exception("Worker did not restart the failed child.");
            int childId = int.Parse(System.IO.File.ReadAllText(stable));
            var child = System.Diagnostics.Process.GetProcessById(childId);
            string log = System.IO.File.ReadAllText(System.IO.Path.Combine(data, "service.log"));
            if (!log.Contains("código 42")) throw new System.Exception("Child failure was not recorded.");
            stop.Invoke(worker, null); started = false;
            if (!child.WaitForExit(5000)) throw new System.Exception("Graceful shutdown left a child process running.");
            if (!System.IO.File.Exists(System.IO.Path.Combine(data, "graceful-exit"))) throw new System.Exception("Child did not receive graceful shutdown signal before Job close.");
            log = System.IO.File.ReadAllText(System.IO.Path.Combine(data, "service.log"));
            if (!log.Contains("Processo encerrou normalmente.")) throw new System.Exception("Supervisor did not log graceful shutdown.");
            child.Dispose();

            System.IO.File.Delete(stable);
            System.IO.File.WriteAllText(System.IO.Path.Combine(data, "hang-on-stop"), "1");
            var worker2 = new Worker(false);
            try {
                start.Invoke(worker2, new object[] { new string[0] }); started = true;
                deadline = System.DateTime.UtcNow.AddSeconds(20);
                while (!System.IO.File.Exists(stable) && System.DateTime.UtcNow < deadline) System.Threading.Thread.Sleep(100);
                if (!System.IO.File.Exists(stable)) throw new System.Exception("Second worker did not start child.");
                int hungId = int.Parse(System.IO.File.ReadAllText(stable));
                var hung = System.Diagnostics.Process.GetProcessById(hungId);
                stop.Invoke(worker2, null); started = false;
                if (!hung.WaitForExit(5000)) throw new System.Exception("Job fallback left an unresponsive child running.");
                log = System.IO.File.ReadAllText(System.IO.Path.Combine(data, "service.log"));
                if (!log.Contains("aplicando recuperação forçada")) throw new System.Exception("Supervisor did not log forced Job fallback.");
                hung.Dispose();
            } finally { if (started) stop.Invoke(worker2, null); worker2.Dispose(); }

            System.Console.WriteLine("Supervisor restarted a failed child, stopped gracefully when responsive, and enforced Job fallback when hung.");
        } finally { if (started) stop.Invoke(worker, null); worker.Dispose(); }
    }
}
`;
  const childSource = String.raw`
using System;
using System.IO;
using System.Threading;
using System.Diagnostics;
internal static class ChildFixture {
    private static void Main() {
        string data = Environment.GetEnvironmentVariable("NEXUS_DATA_DIR");
        string marker = Path.Combine(data, "crashed-once");
        if (!File.Exists(marker)) { File.WriteAllText(marker, "fixture"); Thread.Sleep(600); Environment.Exit(42); }
        File.WriteAllText(Path.Combine(data, "stable-pid"), Process.GetCurrentProcess().Id.ToString());
        Console.WriteLine("Fixture child ready");
        if (File.Exists(Path.Combine(data, "hang-on-stop"))) {
            while (true) Thread.Sleep(1000);
        }
        string line = Console.In.ReadLine();
        if (line == "shutdown" && Environment.GetEnvironmentVariable("NEXUS_SUPERVISED") == "1") {
            File.WriteAllText(Path.Combine(data, "graceful-exit"), "0");
            Environment.Exit(0);
        }
        while (true) Thread.Sleep(1000);
    }
}
`;
  const nativeFile = path.join(directory, 'fixture.cs'), childFile = path.join(directory, 'child.cs');
  fs.writeFileSync(nativeFile, '\ufeff' + native + fixture); fs.writeFileSync(childFile, childSource);
  fs.mkdirSync(path.join(directory, 'runtime'));
  compile(['/target:exe', '/platform:x64', '/out:' + path.join(directory, 'runtime', 'node.exe'), childFile]);
  const executable = path.join(directory, 'fixture.exe');
  compile(['/target:exe', '/platform:x64', '/main:WorkerFixture', '/out:' + executable, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.ServiceProcess.dll', nativeFile, path.join(root,'native','Locale.cs')]);
  const result = spawnSync(executable, [], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr + (result.error || ''));
  process.stdout.write(result.stdout);
} finally {
  assert.ok(path.basename(directory).startsWith('nexus-supervisor-') && path.dirname(directory) === os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
}
