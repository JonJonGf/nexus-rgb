'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Resources}=require('../server/resources'),{diagnostics}=require('../server/diagnostics');

test('diagnóstico agrupa zonas com IDs anônimos e registra energia e brilho solicitados sem exportar cores',()=>{
  const first={id:'a'.repeat(24),controllerId:'b'.repeat(24),type:2,ledCount:1,status:'online',settings:{power:false,brightness:0,nativeMode:3,color:'#a1b2c3'},spatialCapable:true,effects:['static']};
  const devices=[first,{...first,id:'c'.repeat(24),settings:{power:true,brightness:50}},{...first,id:'d'.repeat(24),controllerId:'e'.repeat(24),settings:{power:true,brightness:100}}];
  const report=diagnostics({snapshot:()=>({connected:true,controllerCount:2,devices})},{config:{}},{data:{}},null);
  assert.deepEqual(report.components.map(d=>d.controller),['controller-1','controller-1','controller-2']);
  assert.deepEqual(report.components[0].control,{power:false,brightness:0,nativeMode:3,spatialCapable:true});
  assert.deepEqual(report.components[1].control,{power:true,brightness:50,nativeMode:null,spatialCapable:true});
  const text=JSON.stringify(report);for(const privateValue of ['a'.repeat(24),'b'.repeat(24),'#a1b2c3'])assert.equal(text.includes(privateValue),false);
});
test('resource totals include the owned USB bridge process',async()=>{
  const monitor=new Resources({read:async()=>({partial:false,processes:[{pid:1234,role:'hid-bridge',start:'123',cpuTicks:'0',memoryBytes:2097152}]})});
  const sample=await monitor.sample();assert.equal(sample.processes.find(p=>p.role==='hid-bridge').memoryMB,2);
});
test('medição calcula delta, preserva PID novo, cache e indica acesso parcial',async()=>{
  let now=0,ticks=100000,calls=0,start='123';const monitor=new Resources({now:()=>now,read:async()=>{calls++;return {partial:false,processes:[{pid:2,role:'openrgb',start,cpuTicks:String(ticks),memoryBytes:10485760}]};}});
  const a=await monitor.sample();assert.equal(a.processes[0].cpuPercent,null);assert.equal(a.processes[0].memoryMB,10);now=1000;await monitor.sample();assert.equal(calls,1);now=10000;ticks+=10000000;const b=await monitor.sample();assert.ok(b.processes[0].cpuPercent>=0);assert.ok(b.processes[0].cpuPercent<=100);start='456';now=20000;assert.equal((await monitor.sample()).processes[0].cpuPercent,null);
  monitor.read=async()=>{throw Error('access denied C:\\private');};now=30000;const c=await monitor.sample();assert.equal(c.partial,true);assert.equal(c.processes.some(r=>r.pid===process.pid),true);
});
test('diagnóstico permite só resumo por allowlist, anonimiza componentes e exclui tokens, IPs, MACs, caminhos, seriais, perfis e código',()=>{
  const secrets=[
    'SECRET-TOKEN-998877',
    'hue-user-abcdef123456',
    'SN-9876543210',
    '192.168.15.42',
    'AA:BB:CC:DD:EE:FF',
    'C:\\Users\\pessoa\\AppData\\Local\\NexusRGB',
    'DESKTOP-PESSOAL',
    'Meu Perfil Secreto',
    'function update(){fetch("http://evil")}'
  ];
  const combined=secrets.join(' | ');
  const hardware={
    lostAt:Date.now(),
    snapshot:()=>({
      connected:true,
      controllerCount:1,
      error:combined,
      devices:[{
        ledCount:12,
        type:2,
        kind:'argb',
        error:combined,
        name:combined,
        id:'a'.repeat(24),
        serial:combined,
        location:combined,
        vendor:combined,
        mapExcluded:true
      }]
    })
  };
  const studio={
    hadController:true,
    config:{enabled:true,activeId:combined,values:{x:combined}},
    error:combined,
    recoverySnapshot:()=>({kind:'effect',quarantined:true,message:combined}),
    metrics:{fps:20,renderMs:1,memoryMB:50,dropped:0}
  };
  const store={
    data:{
      alexaEnabled:true,
      performance:{fps:30,powerTransitionMs:600},
      profiles:[{name:combined,settings:{color:combined}}]
    }
  };
  const resources={
    cache:{
      partial:false,
      cpuPercent:1.5,
      memoryMB:84,
      measurementMs:12,
      processes:[{pid:9999,role:'server',memoryMB:52,cpuPercent:0.5,commandLine:combined,path:combined}]
    }
  };
  const report=diagnostics(hardware,studio,store,resources);
  const serialized=JSON.stringify(report);
  for(const s of secrets)assert.equal(serialized.includes(s),false,`Vazamento detectado: ${s}`);
  assert.equal(serialized.includes('a'.repeat(24)),false);
  assert.equal(serialized.includes('9999'),false);
  assert.equal(report.health.state,'partial');
  assert.equal(report.health.totalLEDs,12);
  assert.deepEqual(report.components,[{id:'device-1',controller:'controller-1',kind:'argb',type:2,ledCount:12,status:'error',mapExcluded:true,hasError:true,control:{power:null,brightness:null,nativeMode:null,spatialCapable:false}}]);
  assert.equal(report.errors.studioKind,'effect');
  assert.equal(report.errors.studioQuarantined,true);
  assert.equal(report.errors.hardwareErrorCode,'controller-error');
});
