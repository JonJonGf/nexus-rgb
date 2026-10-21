'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{fork,execFileSync,execFile}=require('node:child_process'),{promisify}=require('node:util');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),run=promisify(execFile),root=path.resolve(__dirname,'..');
if(process.argv[2]==='child'){
  const project=process.env.NEXUS_BENCH_ROOT,{EventEmitter}=require('node:events'),{Store}=require(path.join(project,'server/store')),{Hardware}=require(path.join(project,'server/hardware')),{createApp}=require(path.join(project,'server'));
  const store=new Store(process.env.NEXUS_BENCH_DATA);
  const controller=(name,count,zones=[])=>({name,location:name,vendor:'Nexus benchmark',type:2,serial:'',colors:Array(count).fill({red:0,green:0,blue:0}),zones,modes:[{id:0,name:'Direct',flagList:['perLedColor']}]});
  const devices=[controller('RAM 1',8),controller('RAM 2',8),controller('Board',76,[4,36,36].map((n,id)=>({id,name:'Zone '+id,ledsCount:n,ledsMin:n,ledsMax:n,resizable:false})))];
  class Mock extends EventEmitter{async connect(){}async getControllerCount(){return devices.length;}async getControllerData(i){return devices[i];}async updateMode(){}updateLeds(){}disconnect(){}}
  createApp({directory:process.env.NEXUS_BENCH_DATA,store,hardware:new Hardware(store,{makeClient:()=>new Mock()}),localPort:0,listenHost:'127.0.0.1',disableAlexa:true,disableWelcome:true,getInterfaces:()=>[],cooling:{simulated:true,binaryPath:path.join(root,'dist/cooling/nexus-cooling.exe')}}).then(async app=>{
    const ports=await app.start();process.send({port:ports.localPort});
    process.on('message',async message=>{if(message==='sample')process.send({pid:process.pid,worker:app.studio.worker?.pid,helper:app.cooling?.bridge?.pid,frames:app.studio.revision,error:app.studio.error,coolingError:app.cooling?.error});if(message==='stop'){await app.stop();process.exit(0);}});
    process.on('disconnect',async()=>{await app.stop();process.exit(0);});
  }).catch(error=>{console.error(error);process.exit(1);});
}else{
 (async()=>{
  const base=path.join(root,'data/cooling-dev/benchmark-'+Date.now()),baseline=path.join(base,'baseline');fs.mkdirSync(baseline,{recursive:true});
  const archive=path.join(base,'baseline.tar');execFileSync('git',['archive','HEAD','server','public','scripts','package.json','--output',archive],{cwd:root,windowsHide:true});execFileSync('tar',['-xf',archive,'-C',baseline],{windowsHide:true});
  const report={date:new Date().toISOString(),baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Real Windows process CPU and summed working sets: Node + spatial worker + optional native C# fixture helper. Synthetic SDK: 3 controllers, 5 components, 92 LEDs, Aurora 20 FPS, no browser/preview/OpenRGB/physical sensor I/O. Two repetitions in reverse order. Cooling fixture loads library metadata but does not open hardware. RSS may double-count shared pages. No watts, temperatures or acoustics measured.',node:process.version,logicalProcessors:os.availableParallelism(),scenarios:[]};
  const cases=['baseline','off','monitoring','balanced','turbo'];
  for(let repeat=0;repeat<2;repeat++)for(const scenario of repeat?[...cases].reverse():cases){
    const directory=path.join(base,scenario+'-'+repeat);fs.mkdirSync(directory,{recursive:true});
    const child=fork(__filename,['child'],{windowsHide:true,env:{...process.env,NODE_PATH:path.join(root,'node_modules'),NEXUS_BENCH_ROOT:scenario==='baseline'?baseline:root,NEXUS_BENCH_DATA:directory},stdio:['ignore','ignore','inherit','ipc']});
    try{
      const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Benchmark startup timeout')),15000);child.once('message',value=>{clearTimeout(timer);resolve(value);});child.once('exit',()=>reject(Error('Benchmark child exited')));});
      const origin='http://127.0.0.1:'+ready.port;let cookie;
      async function api(route,body){const response=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{origin,'x-nexus-client':'web','content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok)throw Error(route+': '+response.status);if(route==='/api/session/local')cookie=response.headers.get('set-cookie').split(';')[0];return response.json();}
      await api('/api/session/local',{});const library=await api('/api/studio');await api('/api/settings',{fps:20});await api('/api/studio/play',{activeId:library.activeId,enabled:true});
      if(!['baseline','off'].includes(scenario))await api('/api/cooling/monitor',{});
      if(['balanced','turbo'].includes(scenario))await api('/api/cooling',{enabled:true,profile:scenario,assignments:Array.from({length:6},(_,i)=>({controlId:'fan-'+(i+1),sensorId:i<3?'cpu':'gpu',rpmId:'rpm-'+(i+1),minPercent:40,critical:85}))});
      await sleep(4000);
      async function sample(){const state=await new Promise(resolve=>{child.once('message',resolve);child.send('sample');});if(state.error||state.coolingError)throw Error('Benchmark reported fault');const ids=[state.pid,state.worker,state.helper].filter(Boolean);
        const output=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-Process -Id '+ids.join(',')+' | Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress'],{windowsHide:true,timeout:10000});const rows=JSON.parse(output.stdout);return {...state,at:performance.now(),rows:Array.isArray(rows)?rows:[rows]};}
      const samples=[await sample()];for(let i=0;i<8;i++){await sleep(1000);samples.push(await sample());}
      const first=samples[0],last=samples.at(-1),seconds=(last.at-first.at)/1000;
      const sum=(s,key)=>s.rows.reduce((n,r)=>n+r[key],0),mean=v=>v.reduce((n,x)=>n+x,0)/v.length;
      const result={scenario,repeat:repeat+1,durationSeconds:seconds,cpuPercent:100*(sum(last,'CPU')-sum(first,'CPU'))/seconds/os.availableParallelism(),rssMeanMiB:mean(samples.map(s=>sum(s,'WorkingSet64')/1048576)),privateMeanMiB:mean(samples.map(s=>sum(s,'PrivateMemorySize64')/1048576)),renderFps:(last.frames-first.frames)/seconds,helperPresent:samples.every(s=>Boolean(s.helper)),processCount:first.rows.length};
      report.scenarios.push(result);fs.writeFileSync(path.join(base,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(result));
    }finally{if(child.connected)child.send('stop');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
  }
  console.log('Report: '+path.join(base,'report.json'));
 })().catch(error=>{console.error(error);process.exitCode=1;});
}
