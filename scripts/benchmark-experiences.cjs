'use strict';
// Synthetic SDK only. No installed services, driver, audio or USB access.
// Usage: node scripts/benchmark-experiences.cjs
// Prepare the trusted baseline in data/experiences-validation/baseline first.
// Paths are fixed: this local measurement tool does not load CLI-selected modules.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{fork}=require('node:child_process');
const baseline=path.join(__dirname,'..','data','experiences-validation','baseline');
if(process.argv[2]==='child'){
  const source=process.argv[3];if((source!=='candidate'&&source!=='baseline')||process.argv.length!==4)throw Error('Unknown benchmark source.');
  const root=source==='candidate'?path.resolve(__dirname,'..'):baseline,directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-experience-bench-')),{EventEmitter}=require('node:events'),{Store}=require(path.join(root,'server/store')),{Hardware}=require(path.join(root,'server/hardware')),{createApp}=require(path.join(root,'server'));
  const store=new Store(directory),descriptors=[8,8,76].map((count,i)=>({name:'Synthetic '+i,vendor:'Benchmark',serial:'',location:'benchmark:'+i,type:i<2?1:0,colors:Array(count).fill({red:0,green:0,blue:0}),zones:[],modes:[{id:0,name:'Direct',flagList:['perLedColor']}]}));
  let writes=0;class SDK extends EventEmitter{async connect(){}async getControllerCount(){return 3;}async getControllerData(i){return descriptors[i];}async updateMode(){}updateLeds(){writes++;}disconnect(){}}
  const registry={getDevices:()=>[],getSummary:()=>[],autoDetectHardware:async()=>{},destroy(){}};
  const hardware=new Hardware(store,{makeClient:()=>new SDK(),controllerRegistry:registry});
  createApp({directory,store,hardware,localPort:0,disableHardware:true,disableAlexa:true,getInterfaces:()=>[]}).then(async app=>{
    await app.start();hardware.stopped=false;await hardware.connect();hardware.setFps();process.send({ready:true,port:app.local.address().port});
    const stop=async()=>{try{await app.stop();}finally{fs.rmSync(directory,{recursive:true,force:true});}process.exit(0);};
    process.on('message',async m=>{if(m==='sample')process.send({cpu:process.cpuUsage(),rss:process.memoryUsage().rss,writes,error:hardware.error,worker:Boolean(app.studio.worker)});if(m==='stop')await stop();});
    process.on('disconnect',stop);
  }).catch(e=>{console.error(e);process.exit(1);});
}else{
  (async()=>{
    if(process.argv.length!==2)throw Error('The benchmark uses fixed paths; path arguments are not accepted.');
    if(fs.realpathSync(baseline)!==path.resolve(baseline))throw Error('The baseline folder must not redirect.');
    const outputDirectory=path.join(__dirname,'..','data','experiences-validation');fs.mkdirSync(outputDirectory,{recursive:true});if(fs.realpathSync(outputDirectory)!==path.resolve(outputDirectory))throw Error('The report folder must not redirect.');
    const output=path.join(outputDirectory,'benchmark.json'),seconds=Number(process.env.NEXUS_BENCH_SECONDS||10);
    if(!Number.isInteger(seconds)||seconds<5||seconds>120)throw Error('Choose 5..120 measured seconds per scenario.');
    const report={at:new Date().toISOString(),baseline:'trusted local snapshot (verify its revision before comparing)',candidate:'working tree',node:process.version,processors:os.cpus().length,scope:'Isolated production server and real Hardware with synthetic SDK: three controllers, 92 LEDs (two 8-LED RAM controllers throttled by existing safety gate). Includes HTTP signal processing. No OpenRGB, tray, audio capture, browser, driver or physical network/RGB. Separate child per case; 2 s warm-up. RSS is server working set, not whole application.',scenarios:[]};
    const cases=[['baseline-idle','baseline','idle'],['candidate-idle','candidate','idle'],['baseline-wave60','baseline','wave'],['candidate-wave60','candidate','wave'],['candidate-live60','candidate','live'],['candidate-audio60','candidate','audio']];
    if(process.env.NEXUS_BENCH_REVERSE==='1')cases.reverse();
    for(const [name,source,kind]of cases){
      const child=fork(__filename,['child',source],{windowsHide:true,stdio:['ignore','ignore','inherit','ipc']});let feeder;
      try{
        const ready=await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Benchmark child exit '+code)));}),origin='http://127.0.0.1:'+ready.port;let cookie;
        const api=async(route,body)=>{const response=await fetch(origin+route,{method:'POST',headers:{Origin:origin,'X-Nexus-Client':'web','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});if(!response.ok)throw Error(await response.text());if(route==='/api/session/local')cookie=response.headers.get('set-cookie').split(';')[0];return response.json();};
        await api('/api/session/local',{});await api('/api/settings',{fps:60});await api('/api/control',{effect:kind==='wave'?'wave':'static',color:'#003344',brightness:80});
        if(kind==='audio')await api('/api/experiences/settings',{audio:{enabled:true,gain:1,palette:['#ff0055','#00ff99','#0099ff'],axis:'y'}});
        let inFlight=false,phase=0,feedError=null;
        if(['live','audio'].includes(kind))feeder=setInterval(async()=>{if(inFlight)return;inFlight=true;try{phase+=.1;await api('/api/experiences/'+(kind==='audio'?'signal':'live'),kind==='audio'?{bands:[Math.abs(Math.sin(phase)),.3,.1],capture:'active'}:{events:[{x:(Math.sin(phase)+1)/2,y:.5,color:'#00ffff',kind:'ripple',durationMs:1200}]});}catch(e){feedError=e;}finally{inFlight=false;}},kind==='audio'?125:100);
        await new Promise(r=>setTimeout(r,2000));const sample=()=>new Promise(resolve=>{child.once('message',resolve);child.send('sample');}),first=await sample(),start=performance.now(),samples=[first];
        for(let i=0;i<seconds;i++){await new Promise(r=>setTimeout(r,1000));samples.push(await sample());}
        const elapsed=(performance.now()-start)/1000,last=samples.at(-1);if(feedError||samples.some(s=>s.error||s.worker))throw feedError||Error('Unexpected renderer/error');
        const cpu=s=>s.cpu.user+s.cpu.system;report.scenarios.push({name,seconds:elapsed,cpuPercentOfMachine:(cpu(last)-cpu(first))/1e6/elapsed/os.cpus().length*100,rssMeanMiB:samples.reduce((n,s)=>n+s.rss,0)/samples.length/1048576,rssPeakMiB:Math.max(...samples.map(s=>s.rss))/1048576,simulatedWritesPerSecond:(last.writes-first.writes)/elapsed});fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report.scenarios.at(-1)));
      }finally{clearInterval(feeder);if(child.connected)child.send('stop');await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
    }
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
