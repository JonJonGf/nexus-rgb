'use strict';
// Read-only with respect to the installed app: all RGB writes target a mock SDK
// in an isolated worker and data directory. Requires Windows, Edge and a Git baseline.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {fork,execFileSync,execFile}=require('node:child_process'),{promisify}=require('node:util');
const {chromium}=require('playwright'),run=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const root=path.resolve(__dirname,'..'),baseline=process.argv[2]||'v0.1.0-alpha.12';
const reportPath=path.resolve(process.argv[3]||path.join(root,'data','ui-benchmark.json'));
if(!/^[a-zA-Z0-9._/-]+$/.test(baseline)||baseline.startsWith('-'))throw Error('Invalid baseline');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-ui-bench-'));
let child,browser;
async function main(){
 child=fork(path.join(root,'tests/fixtures/ui-benchmark-worker.js'),[],{env:{...process.env,NEXUS_BENCH_DATA:directory},windowsHide:true,stdio:['ignore','ignore','inherit','ipc']});
 const ready=await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);});
 const origin='http://127.0.0.1:'+ready.port;let cookie;
 async function api(route,body){const r=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{origin,'X-Nexus-Client':'web','content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(r.status,200,await r.clone().text());if(route==='/api/session/local')cookie=r.headers.get('set-cookie').split(';')[0];return r.json();}
 await api('/api/session/local',{});
 for(let i=0;i<4;i++)await api('/api/profiles',{name:'Benchmark profile '+(i+1)});
 for(let i=0;i<29;i++)await api('/api/studio/import',{source:JSON.stringify({format:'nexus-effect/1',name:'Benchmark effect '+(i+1),pattern:'wave',palette:['#00c8ff','#7954ff','#ff0055'],speed:30,angle:i*5,scale:1})});
 await api('/api/settings',{fps:20});const studio=await api('/api/studio');await api('/api/studio/play',{activeId:studio.effects.find(e=>e.builtin).id,enabled:true});
 const old=new Map(['index.html','app.js','studio.js','style.css','studio.css','spatial.js'].map(file=>[file,execFileSync('git',['show',baseline+':public/'+file],{cwd:root})]));
 const report={at:new Date().toISOString(),baseline,comparison:'working tree',cpu:os.cpus()[0].model,logicalProcessors:os.cpus().length,os:os.release(),node:process.version,fixture:{controllers:3,devices:5,leds:92,profiles:4,effects:32,requestedFps:20},scope:'Dedicated headless Edge browser tree and separate mock-SDK server/renderer. Browser RSS is summed working set (shared pages may count twice). JS heap is renderer V8 only. CPU is percent of entire machine. Excludes installed Nexus/OpenRGB, supervisors, tray, driver and benchmark harness. No physical LED measurement.',warmupSeconds:3,samplesPerRun:5,intervalRequestedSeconds:3,runs:[]};
 for(const round of [0,1])for(const entry of (round?[{version:'new',language:'en',view:'library'},{version:'new',language:'en',view:'map'},{version:'new',language:'pt-BR',view:'map'},{version:'baseline',language:'pt-BR',view:'map'}]:[{version:'baseline',language:'pt-BR',view:'map'},{version:'new',language:'pt-BR',view:'map'},{version:'new',language:'en',view:'map'},{version:'new',language:'en',view:'library'}])){
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900},locale:entry.language,serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(entry.version==='baseline')await page.route(origin+'/**',route=>{const file=new URL(route.request().url()).pathname.slice(1)||'index.html';if(old.has(file))return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:old.get(file)});return route.continue();});
  await page.goto(origin);await page.waitForFunction(()=>!document.getElementById('power').disabled);await page.locator('[data-page=studio]').click();await page.waitForFunction(()=>document.querySelectorAll('.studio-item').length===5);
  if(entry.view==='library')await page.locator('#studio-choose').click();
  const cdp=await page.context().newCDPSession(page),system=await browser.newBrowserCDPSession();await cdp.send('Performance.enable');
  const sample=async()=>{
   const tree=await system.send('SystemInfo.getProcessInfo'),ids=tree.processInfo.map(p=>p.id);
   // A short-lived Edge utility process can exit between the two snapshots.
   // Enumerate live processes first instead of treating a missing PID as failure.
   const result=await run('powershell.exe',['-NoProfile','-Command','$nexusBrowserIds=@('+ids.join(',')+'); Get-Process -ErrorAction Stop | Where-Object {$nexusBrowserIds -contains $_.Id} | Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress'],{windowsHide:true,timeout:10000});
   const processes=JSON.parse(result.stdout),metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
   const backend=await new Promise(resolve=>{child.once('message',resolve);child.send('sample');});assert.equal(backend.error,null);
   return{at:performance.now(),cpu:tree.processInfo.reduce((n,p)=>n+p.cpuTime,0),rss:(Array.isArray(processes)?processes:[processes]).reduce((n,p)=>n+p.WorkingSet64,0)/1048576,private:(Array.isArray(processes)?processes:[processes]).reduce((n,p)=>n+p.PrivateMemorySize64,0)/1048576,heap:metrics.JSHeapUsedSize/1048576,nodes:metrics.Nodes,task:metrics.TaskDuration,backend};
  };
  await sleep(3000);const samples=[await sample()];for(let i=0;i<4;i++){await sleep(3000);samples.push(await sample());}
  const first=samples[0],last=samples.at(-1),seconds=(last.at-first.at)/1000,mean=k=>samples.reduce((n,s)=>n+s[k],0)/samples.length;
  const row={round,...entry,durationSeconds:seconds,cpuPercentOfMachine:100*(last.cpu-first.cpu)/seconds/os.cpus().length,rssMeanMiB:mean('rss'),rssPeakMiB:Math.max(...samples.map(s=>s.rss)),privateMeanMiB:mean('private'),heapMeanMiB:mean('heap'),heapStartMiB:first.heap,heapEndMiB:last.heap,domNodesMean:mean('nodes'),mainThreadBusyPercent:100*(last.task-first.task)/seconds,renderedFps:last.backend.metrics.fps,errors};
  assert.deepEqual(errors,[]);report.runs.push(row);fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(row));
  await browser.close();browser=null;
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();if(child?.connected){child.send('stop');await new Promise(resolve=>child.once('exit',resolve));}
 const target=path.resolve(directory);if(path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('nexus-ui-bench-'))throw Error('Invalid temporary directory');fs.rmSync(target,{recursive:true,force:true});
});
