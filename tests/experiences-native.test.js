'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('native band analyzer separates bass, mids and treble without keeping samples', {skip:process.platform!=='win32'},t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-bands-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const source=path.join(directory,'probe.cs'),exe=path.join(directory,'probe.exe');
  fs.writeFileSync(source,`using System; internal static class Program {internal static string Panel {get{throw new Exception("Unavailable port settings");}} static void Main(){using(var bridge=new ExperiencesBridge()){}int index=0;foreach(int frequency in new int[]{60,800,8000}){var meter=new BandMeter(48000);for(int n=0;n<48000;n++)meter.Add(.1*Math.Sin(n*2*Math.PI*frequency/48000));var bands=meter.Read();for(int j=0;j<3;j++)if(j!=index&&bands[index]<=bands[j])throw new Exception("Wrong dominant band");foreach(double v in meter.Read())if(v!=0)throw new Exception("Samples retained");index++;}Console.WriteLine("bands-ok");}}`);
  const compiler=path.join(process.env.SystemRoot,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  const compiled=spawnSync(compiler,['/nologo','/target:exe','/out:'+exe,'/reference:System.Web.Extensions.dll',source,path.resolve('native/ExperiencesBridge.cs')],{encoding:'utf8',windowsHide:true});assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
  const run=spawnSync(exe,[],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/bands-ok/);
});

test('interactive tray bridge authenticates over loopback and sends only bounded signals', {skip:process.platform!=='win32'},async t=>{
  const {fixture}=require('./helpers/http-app'),{spawn}=require('node:child_process');
  const {app,request,cookie,origin,directory}=await fixture(t);
  const p=app.store.profile('Inactive rule',{palette:['#00ffff'],effect:'static'});
  app.experiences.configure({context:{enabled:true,rules:[{application:'nexus-fixture-not-running.exe',profileId:p.id}]}});
  const source=path.join(directory,'bridge-fixture.cs'),exe=path.join(directory,'bridge-fixture.exe');
  fs.writeFileSync(source,`using System;using System.Threading;using System.Windows.Forms;internal static class Program{internal static string Panel;[STAThread]static void Main(string[] args){Panel=args[0]+"/";SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());using(var bridge=new ExperiencesBridge())using(var timer=new System.Windows.Forms.Timer()){var context=new ApplicationContext();int ticks=0;timer.Interval=200;timer.Tick+=(s,e)=>{if(++ticks>15){timer.Stop();context.ExitThread();}else bridge.Tick();};timer.Start();Application.Run(context);}}}`);
  const compiler=path.join(process.env.SystemRoot,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),compiled=spawnSync(compiler,['/nologo','/target:exe','/out:'+exe,'/reference:System.Web.Extensions.dll','/reference:System.Windows.Forms.dll',source,path.resolve('native/ExperiencesBridge.cs')],{encoding:'utf8',windowsHide:true});assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
  const child=spawn(exe,[origin],{windowsHide:true,stdio:'ignore'});t.after(()=>{if(child.exitCode===null)child.kill();});
  await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native bridge exit '+code)));});
  assert.equal((await request('/api/experiences',{cookie})).json().capture,'stopped');assert.equal(app.experiences.agentConfig().audio,false);
});
