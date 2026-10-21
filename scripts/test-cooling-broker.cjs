'use strict';
// Actual Windows kill-on-close Job + native fixture. Never enumerates sensors.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-cooling-job-'));
const native=fs.readFileSync(path.join(root,'native/NexusRGB.cs'),'utf8');
const job=native.slice(native.indexOf('internal static class Job {'));
const source=String.raw`
using System;using System.Diagnostics;using System.Runtime.InteropServices;
internal static class L {internal static string T(string s){return s;}}
internal static class BrokerFixture {
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool IsProcessInJob(IntPtr p,IntPtr j,out bool result);
 static void Main(string[] args){
  IntPtr job=Job.Create();Process child=null;Process helper=null;
  try{
   child=Process.Start(new ProcessStartInfo(args[0],"\""+args[1]+"\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true});
   if(!Job.Assign(job,child.Handle))throw new Exception("Cannot assign fixture parent to Job");
   child.StandardInput.WriteLine("start");
   var line=child.StandardOutput.ReadLineAsync();
   if(!line.Wait(25000))throw new Exception("Helper launch timed out");
   int pid;if(!int.TryParse(line.Result,out pid))throw new Exception("No helper PID: "+child.StandardError.ReadToEnd());
   helper=Process.GetProcessById(pid);bool member;
   if(!IsProcessInJob(child.Handle,job,out member)||!member)throw new Exception("Parent not in Job");
   if(!IsProcessInJob(helper.Handle,job,out member)||member)throw new Exception("Helper shares kill-on-close Job");
   Job.Close(job);job=IntPtr.Zero;
   if(!child.WaitForExit(5000))throw new Exception("Parent survived Job close");
   if(!helper.WaitForExit(9000))throw new Exception("Helper watchdog did not close after parent death");
   Console.WriteLine("Native fixture stays outside RGB Job; parent death closes helper via watchdog.");
  }finally{if(job!=IntPtr.Zero)Job.Close(job);if(child!=null)child.Dispose();if(helper!=null)helper.Dispose();}
 }
}
`+job;
try{
 const input=path.join(temp,'fixture.cs'),output=path.join(temp,'fixture.exe');fs.writeFileSync(input,source);
 const build=spawnSync(path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+output,input],{encoding:'utf8',windowsHide:true});
 assert.equal(build.status,0,build.stdout+build.stderr);
 const result=spawnSync(output,[process.execPath,path.join(root,'tests/fixtures/cooling-broker-parent.cjs')],{encoding:'utf8',windowsHide:true,timeout:45000});
 assert.equal(result.status,0,result.stdout+result.stderr);process.stdout.write(result.stdout);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
