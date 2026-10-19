'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Conflicts, KNOWN_CONFLICTING_APPS } = require('../server/conflicts');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

test('a failed Windows lighting query stays unknown rather than reporting a completed clear check',async()=>{
  const report=await new Conflicts({queryWindowsDynamicLighting:async()=>{throw Error('Synthetic registry failure');},queryRunningProcesses:async()=>[]}).sample();
  assert.equal(report.dynamicLighting.enabled,false);assert.equal(report.dynamicLighting.partial,true);assert.equal(report.hasConflicts,false);
});

test('Dynamic Lighting checks loaded user profiles rather than the service account',()=>{
  const result=spawnSync(process.execPath,['-e',String.raw`
    const assert=require('node:assert/strict'),cp=require('node:child_process');
    Object.defineProperty(process,'platform',{value:'win32'});
    const sid='S-1-5-21-100-200-300-1001',calls=[];
    cp.execFile=(file,args,options,callback)=>{
      calls.push([file,...args]);let value='',error=null;
      if(file==='tasklist.exe')value='';
      else if(args[1]==='HKU')value='HKEY_USERS\\.DEFAULT\r\nHKEY_USERS\\S-1-5-19\r\nHKEY_USERS\\'+sid+'\r\nHKEY_USERS\\'+sid+'_Classes\r\n';
      else if(args[1]==='HKU\\'+sid+'\\Software\\Microsoft\\Lighting')value='AmbientLightingEnabled    REG_DWORD    0x1';
      else if(args[1].startsWith('HKCU'))value='AmbientLightingEnabled    REG_DWORD    0x0';
      else error=Error('Unexpected registry query');
      queueMicrotask(()=>callback(error,value,''));return {kill(){}};
    };
    (async()=>{
      const {Conflicts}=require(process.env.NEXUS_CONFLICTS_MODULE),report=await new Conflicts().sample();
      assert.equal(report.dynamicLighting.enabled,true,'An enabled interactive profile was hidden by the service account preference');
      assert.equal(report.dynamicLighting.scope,'loaded-user-profiles');
      assert.equal(report.dynamicLighting.checkedProfiles,1);
      assert.equal(report.hasConflicts,true);
      assert(!JSON.stringify(report).includes(sid),'User SID leaked in the report');
      assert(calls.every(call=>!call.some(arg=>typeof arg==='string'&&arg.startsWith('HKCU'))));
      console.log('loaded-profile-conflict-detected');
    })().catch(error=>{console.error(error);process.exitCode=1});
  `],{encoding:'utf8',windowsHide:true,timeout:8000,env:{...process.env,NEXUS_CONFLICTS_MODULE:path.resolve(__dirname,'../server/conflicts')}});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/loaded-profile-conflict-detected/);
});

test('profile lighting queries keep unknown states explicit, private and bounded',()=>{
  const result=spawnSync(process.execPath,['-e',String.raw`
    const assert=require('node:assert/strict'),cp=require('node:child_process');Object.defineProperty(process,'platform',{value:'win32'});
    let fixture,queries,clock=0;Object.defineProperty(performance,'now',{value:()=>clock});
    const sid=i=>'S-1-5-21-100-200-300-'+(1000+i);
    cp.execFile=(file,args,options,callback)=>{
      assert.equal(file,'reg.exe');assert(options.timeout>0&&options.timeout<=3000);assert(options.maxBuffer<=262144);
      queries++;let value='',error=null;
      if(args[1]==='HKU'){
        if(fixture.rootError)error=Error('Access denied');
        else value=Array.from({length:fixture.profiles},(_,i)=>'HKEY_USERS\\'+sid(i)).join('\n');
        if(fixture.expired)clock=4000;
      }else{
        const index=Array.from({length:fixture.profiles},(_,i)=>sid(i)).findIndex(id=>args[1]==='HKU\\'+id+'\\Software\\Microsoft\\Lighting');
        assert(index>=0,'Unexpected key');
        if(fixture.unknown?.includes(index))error=Error('Missing or unreadable value');
        else value=fixture.malformed?'Unexpected registry response':'AmbientLightingEnabled REG_DWORD 0x'+(fixture.on?.includes(index)?'1':'0');
      }
      queueMicrotask(()=>callback(error,value,''));return {kill(){}};
    };
    const {Conflicts}=require(process.env.NEXUS_CONFLICTS_MODULE);
    (async()=>{
      for(const data of [
        {profiles:2,expected:[true,false,2,false,3]},
        {profiles:2,on:[0],unknown:[1],expected:[true,true,1,true,3]},
        {profiles:2,unknown:[1],expected:[true,false,1,true,3]},
        {profiles:1,malformed:true,expected:[false,false,0,true,2]},
        {profiles:0,expected:[false,false,0,true,1]},
        {profiles:1,rootError:true,expected:[false,false,0,true,1]},
        {profiles:20,expected:[true,false,16,true,17]},
        {profiles:4,expired:true,expected:[false,false,0,true,1]}
      ]){
        fixture=data;queries=0;clock=0;
        const report=await new Conflicts({queryRunningProcesses:async()=>[]}).sample(),d=report.dynamicLighting;
        assert.deepEqual([d.supported,d.enabled,d.checkedProfiles,d.partial,queries],data.expected);
        assert.equal(report.hasConflicts,d.enabled);assert(!JSON.stringify(report).includes('S-1-5-21'));
      }
      console.log('unknown-private-bounded');
    })().catch(error=>{console.error(error);process.exitCode=1});
  `],{encoding:'utf8',windowsHide:true,timeout:8000,env:{...process.env,NEXUS_CONFLICTS_MODULE:path.resolve(__dirname,'../server/conflicts')}});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/unknown-private-bounded/);
});

test('conflicts: identifica quando Windows Dynamic Lighting está ativo ou desativado', async () => {
  let simulatedStdout = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Lighting\r\n    AmbientLightingEnabled    REG_DWORD    0x1';
  let conflicts = new Conflicts({
    queryWindowsDynamicLighting: async () => {
      const match = /AmbientLightingEnabled\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(simulatedStdout);
      return { supported: true, enabled: match ? parseInt(match[1], 16) !== 0 : false };
    },
    queryRunningProcesses: async () => []
  });

  let res = await conflicts.sample();
  assert.equal(res.dynamicLighting.supported, true);
  assert.equal(res.dynamicLighting.enabled, true);
  assert.equal(res.hasConflicts, true);

  // Simular desativado (0x0)
  simulatedStdout = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Lighting\r\n    AmbientLightingEnabled    REG_DWORD    0x0';
  conflicts = new Conflicts({
    queryWindowsDynamicLighting: async () => {
      const match = /AmbientLightingEnabled\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(simulatedStdout);
      return { supported: true, enabled: match ? parseInt(match[1], 16) !== 0 : false };
    },
    queryRunningProcesses: async () => []
  });

  res = await conflicts.sample();
  assert.equal(res.dynamicLighting.supported, true);
  assert.equal(res.dynamicLighting.enabled, false);
  assert.equal(res.hasConflicts, false);
});

test('conflicts: identifica processos concorrentes conhecidos via allowlist', async () => {
  const simulatedProcesses = [
    { id: 'icue', name: 'Corsair iCUE', process: 'icue.exe' },
    { id: 'armoury-crate', name: 'ASUS Armoury Crate / Aura', process: 'lightingservice.exe' }
  ];

  const conflicts = new Conflicts({
    queryWindowsDynamicLighting: async () => ({ supported: true, enabled: false }),
    queryRunningProcesses: async () => simulatedProcesses
  });

  const res = await conflicts.sample();
  assert.equal(res.conflicts.length, 2);
  assert.equal(res.conflicts[0].id, 'icue');
  assert.equal(res.conflicts[0].name, 'Corsair iCUE');
  assert.equal(res.conflicts[1].id, 'armoury-crate');
  assert.equal(res.hasConflicts, true);
});

test('conflicts: reutiliza cache dentro de 15 segundos sem nova consulta', async () => {
  let calls = 0;
  let nowTime = 1000;
  const conflicts = new Conflicts({
    now: () => nowTime,
    queryWindowsDynamicLighting: async () => { calls++; return { supported: true, enabled: false }; },
    queryRunningProcesses: async () => []
  });

  await conflicts.sample();
  assert.equal(calls, 1);

  // 5 segundos depois
  nowTime += 5000;
  await conflicts.sample();
  assert.equal(calls, 1, 'Cache deve ser reutilizado');

  // 16 segundos depois
  nowTime += 11000;
  await conflicts.sample();
  assert.equal(calls, 2, 'Nova consulta deve ser feita após 15 segundos');
});

test('conflicts: consulta real no sistema Windows executa sem erros', async () => {
  const conflicts = new Conflicts();
  const res = await conflicts.sample();
  assert.equal(typeof res.hasConflicts, 'boolean');
  assert.equal(typeof res.dynamicLighting.supported, 'boolean');
  assert.equal(typeof res.dynamicLighting.enabled, 'boolean');
  assert.ok(Array.isArray(res.conflicts));
});
