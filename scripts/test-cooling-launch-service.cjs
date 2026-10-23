'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {spawnSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-launch-service-'));
const pipe='NexusRGB.Cooling.Broker.Fixture.'+process.pid;
const source=String.raw`
using System;using System.Security.Principal;using System.Threading;
class LaunchFixture {
 static void Main(string[] args){
  if(args.Length==1){Console.WriteLine(CoolingLaunchBroker.PackageEligible(args[0])?"eligible":"disabled");return;}
  int expected=int.Parse(args[1]);
  using(var broker=new CoolingLaunchBroker(AppDomain.CurrentDomain.BaseDirectory,args[0],pid=>pid==expected,(pid,name)=>12345,WindowsIdentity.GetCurrent().User)){
   broker.Start();Console.WriteLine("ready");Console.In.ReadLine();
  }
 }
}`;
(async()=>{
 let child;
 try{
  const input=path.join(temp,'test.cs'),exe=path.join(temp,'test.exe');fs.writeFileSync(input,source);
  const result=spawnSync(path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/reference:System.Management.dll','/reference:System.Web.Extensions.dll','/out:'+exe,input,path.join(root,'native/CoolingLaunchBroker.cs')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);
  const packageRoot=path.join(temp,'package'),commit='a'.repeat(40);fs.mkdirSync(path.join(packageRoot,'server'),{recursive:true});fs.mkdirSync(path.join(packageRoot,'cooling'));fs.writeFileSync(path.join(packageRoot,'cooling/nexus-cooling.exe'),'fixture-not-executed');
  const write=(name,value)=>fs.writeFileSync(path.join(packageRoot,'server',name),JSON.stringify(value));
  const build={commit,tag:'v0.1.0-alpha.41',development:false};write('cooling-package.json',{format:'nexus-cooling-package/1',commit});
  const policy=expected=>{const r=spawnSync(exe,[packageRoot],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),expected);};
  write('build-info.json',build);policy('eligible');
  for(const change of [{tag:'v0.1.0'},{tag:'v0.1.0-beta.1'},{development:true},{tag:null},{commit:'b'.repeat(40)}]){write('build-info.json',{...build,...change});policy('disabled');}
  write('build-info.json',{commit,tag:null,development:true});policy('eligible');
  console.log('Native package policy: matching alpha/development only; stable, malformed and mismatched payloads disabled. No hardware launched.');
  child=spawn(exe,[pipe,String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
  const request=body=>new Promise((resolve,reject)=>{
   const open=(attempt=0)=>{
    const socket=net.connect('\\\\.\\pipe\\'+pipe);let text='';
    socket.once('connect',()=>socket.write(typeof body==='string'?body:JSON.stringify(body)+'\n'));
    socket.on('data',chunk=>{text+=chunk;if(text.includes('\n')){socket.end();resolve(JSON.parse(text));}});
    socket.once('error',e=>{if(['ENOENT','EBUSY'].includes(e.code)&&attempt<30)setTimeout(()=>open(attempt+1),50);else reject(e);});
    socket.setTimeout(5000,()=>{socket.destroy();reject(Error('Fixture timeout'));});
   };open();
  });
  const good={parent:process.pid,pipe:'NexusRGB.Cooling.Dev.'+'a'.repeat(32)};
  assert.deepEqual(await request(good),{status:'ok',pid:12345});
  for(const bad of [{...good,parent:process.pid+1},{...good,pipe:'arbitrary --hardware'},{...good,executable:'untrusted.exe'},{pipe:good.pipe},{...good,parent:String(process.pid)},'{invalid}\n'])assert.equal((await request(bad)).status,'error');
  console.log('Native service broker IPC: exact client PID, bounded schema, pipe format, arbitrary executable/arguments and invalid JSON checks passed. Launch adapter simulated; no sensors/services touched.');
 }finally{
  if(child){child.stdin.end('stop\n');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
