'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {installedCooling}=require('../server/cooling-installation');
test('only a matching development package enables installed cooling, without launching hardware',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-cooling-install-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'server'));fs.mkdirSync(path.join(root,'cooling'));
 const write=(file,value)=>fs.writeFileSync(path.join(root,'server',file),JSON.stringify(value));
 const commit='a'.repeat(40),build={version:'0.1.0',tag:null,commit,development:true};
 assert.deepEqual(installedCooling(root),{});
 write('build-info.json',build);write('cooling-development.json',{format:'nexus-cooling-development/1',commit});
 assert.deepEqual(installedCooling(root),{});fs.writeFileSync(path.join(root,'cooling/nexus-cooling.exe'),'fixture-not-executed');
 assert.deepEqual(installedCooling(root),{allowHardware:true,brokered:true,binaryPath:path.join(root,'cooling/nexus-cooling.exe')});
 write('build-info.json',{...build,development:false,tag:'v0.1.0-alpha.40'});assert.deepEqual(installedCooling(root),{});
 write('build-info.json',build);write('cooling-development.json',{format:'nexus-cooling-development/1',commit:'b'.repeat(40)});assert.deepEqual(installedCooling(root),{});
});
