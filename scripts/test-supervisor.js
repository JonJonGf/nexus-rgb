'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
if (process.platform !== 'win32') throw Error('Este teste exige Windows.');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-supervisor-'));
const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
function compile(args) {
  const result = spawnSync(compiler, ['/nologo', ...args], { encoding: 'utf8', windowsHide: true });
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
        if (Program.RecoveryInstalled()) throw new System.Exception("Recovery accepted an executable outside Program Files.");
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
            if (!child.WaitForExit(5000)) throw new System.Exception("Job shutdown left a child process running.");
            child.Dispose();
            System.Console.WriteLine("Supervisor restarted a failed child and stopped its Job without leaving it running.");
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
        while (true) Thread.Sleep(1000);
    }
}
`;
  const nativeFile = path.join(directory, 'fixture.cs'), childFile = path.join(directory, 'child.cs');
  fs.writeFileSync(nativeFile, '\ufeff' + native + fixture); fs.writeFileSync(childFile, childSource);
  fs.mkdirSync(path.join(directory, 'runtime'));
  compile(['/target:exe', '/platform:x64', '/out:' + path.join(directory, 'runtime', 'node.exe'), childFile]);
  const executable = path.join(directory, 'fixture.exe');
  compile(['/target:exe', '/platform:x64', '/main:WorkerFixture', '/out:' + executable, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.ServiceProcess.dll', nativeFile]);
  const result = spawnSync(executable, [], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr + (result.error || ''));
  process.stdout.write(result.stdout);
} finally {
  assert.ok(path.basename(directory).startsWith('nexus-supervisor-') && path.dirname(directory) === os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
}
