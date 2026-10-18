'use strict';
// Real Inno startup/uninstall guards, with a unique inert product and mutex.
// No Nexus services, RGB, drivers or installed application files are touched.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-tray-setup-fixture-'));
const product=path.join(directory,'product'),mutex='Local\\NexusRGB.TrayFixture.'+path.basename(directory);
let holder;
function run(file,args){return spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout:20000});}
async function main(){
  const source=fs.readFileSync(path.join(root,'installer/NexusRGB.iss'),'utf8');
  const directive=(source.match(/^AppMutex=.*$/m)?.[0]||'').replace('Local\\NexusRGB.Tray',mutex);
  const guard=source.includes('function InitializeUninstall:')?source.slice(source.indexOf('function InitializeUninstall:'),source.indexOf('procedure CurUninstallStepChanged')).replaceAll('Local\\NexusRGB.Tray',mutex):'';
  fs.writeFileSync(path.join(directory,'fixture.iss'),'\ufeff'+`[Setup]
AppId=NexusTrayFixture-${path.basename(directory)}
AppName=Nexus tray test fixture
AppVersion=1
DefaultDirName=${product}
PrivilegesRequired=lowest
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=${directory}
OutputBaseFilename=fixture
${directive}
[Code]
function LocalText(Portuguese, English: String): String;
begin Result := English; end;
${guard}
`);
  let result=run(path.join(root,'tools/inno/ISCC.exe'),['/Q',path.join(directory,'fixture.iss')]);assert.equal(result.status,0,result.stdout+result.stderr);
  fs.writeFileSync(path.join(directory,'holder.cs'),'using System;using System.Threading;class Holder{static void Main(string[] args){using(var m=new Mutex(true,args[0])){Console.WriteLine("ready");Console.ReadLine();}}}');
  result=run(path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+path.join(directory,'holder.exe'),path.join(directory,'holder.cs')]);assert.equal(result.status,0,result.stdout+result.stderr);
  holder=spawn(path.join(directory,'holder.exe'),[mutex],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  await Promise.race([once(holder.stdout,'data'),once(holder,'exit').then(()=>{throw Error('Mutex holder exited early');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Mutex startup timeout')),10000);timer.unref();})]);
  result=run(path.join(directory,'fixture.exe'),['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/LOG='+path.join(directory,'install.log')]);
  assert.equal(result.status,0,'Installer must reach owned-process preparation before checking the old tray mutex. '+fs.readFileSync(path.join(directory,'install.log'),'utf8'));
  const uninstall=path.join(product,'unins000.exe');
  result=run(uninstall,['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART']);assert.notEqual(result.status,0,'Uninstall must still reject an active tray mutex');assert.equal(fs.existsSync(uninstall),true);
  holder.stdin.end('\n');await once(holder,'exit');holder=null;
  result=run(uninstall,['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART']);assert.equal(result.status,0,result.stdout+result.stderr);
  console.log('Installer reaches preflight with tray open; uninstall still refuses an active tray mutex.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(holder&&holder.exitCode===null){holder.stdin.end('\n');await once(holder,'exit');}
  const uninstall=path.join(product,'unins000.exe');if(fs.existsSync(uninstall))run(uninstall,['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART']);
  if(path.dirname(directory)!==os.tmpdir()||!path.basename(directory).startsWith('nexus-tray-setup-fixture-'))throw Error('Unsafe fixture cleanup');
  fs.rmSync(directory,{recursive:true,force:true});
});
