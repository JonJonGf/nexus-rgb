'use strict';
// Public executable seam; fixture input never opens hardware, WMI or the installed service.
const {spawnSync}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const directory=path.resolve('data/gpu-report-tests');fs.mkdirSync(directory,{recursive:true});
const source={build:{version:'0.1.0',tag:'v0.1.0-alpha.40',commit:'b967667f64c5d51c0cdae8784cd7849f95c28ca7',development:false,token:'SECRET'},
 hardware:{connected:true,controllerHung:false,devices:[{id:'PRIVATE-SERIAL',name:'Gigabyte Radeon RX 7600 GAMING OC 8G',controllerName:'Gigabyte Radeon RX 7600 GAMING OC 8G',controllerId:'private-parent',type:2,ledCount:1,spatialCapable:true,status:'online',settings:{power:true,brightness:50,nativeMode:0,color:'#ff0000',secret:'SECRET'},modes:[{id:0,name:'Direct'}],serial:'PRIVATE-SERIAL',location:'C:\\Users\\PrivateUser'}]},master:{power:true,brightness:50},profiles:[{name:'SECRET'}],alexa:{token:'SECRET'}};
source.hardware.devices[0].delivery={modeConfigured:true,modeId:0,modeBrightness:99,frameQueued:true,frameBlack:false,physicalConfirmation:'UNTRUSTED',token:'SECRET'};
const input=path.join(directory,'input.json');fs.writeFileSync(input,JSON.stringify(source));
const result=spawnSync(path.resolve('dist/diagnostics/NexusRGB-Diagnostic.exe'),['--fixture',input],{encoding:'utf8',windowsHide:true,timeout:10000});
assert.equal(result.error,undefined,String(result.error));assert.equal(result.status,0,result.stderr);
const report=JSON.parse(result.stdout);assert.equal(report.format,'nexus-gpu-report/1');
assert.deepEqual(report.controller.devices[0].delivery,{modeConfigured:true,modeId:0,modeBrightness:99,frameQueued:true,frameBlack:false,physicalConfirmation:'not-measured'});
assert.equal(report.collector.version,2);
assert.equal(report.controller.devices[0].requested.power,true);assert.equal(report.controller.devices[0].requested.brightness,50);
assert.equal(report.controller.devices[0].modes[0].name,'Direct');assert.equal(report.controller.physicalConfirmation,'not-measured');
assert.match(JSON.stringify(report.findings),/not proof|não comprova/);
assert.doesNotMatch(result.stdout,/SECRET|PRIVATE-SERIAL|PrivateUser|private-parent|#ff0000/);
const malformed=spawnSync(path.resolve('dist/diagnostics/NexusRGB-Diagnostic.exe'),['--fixture',input+'-missing'],{encoding:'utf8',windowsHide:true,timeout:10000});
assert.notEqual(malformed.status,0);assert.doesNotMatch(malformed.stderr,/PrivateUser/);
console.log('GPU collector executable: fixture, capability/request distinction, allowlist and error privacy passed; no hardware accessed.');
const logRoot=path.join(directory,'logs');fs.mkdirSync(path.join(logRoot,'hardware'),{recursive:true});fs.mkdirSync(path.join(logRoot,'app'),{recursive:true});fs.writeFileSync(path.join(logRoot,'app','service.log'),'');
fs.writeFileSync(path.join(logRoot,'hardware','service.log'),[
 '2026-10-22T20:00:00Z [Error]PawnIO module initialization aborted (code=-2147023728)',
 '2026-10-22T20:00:01Z [Error]PawnIO module initialization aborted (code=0x80070490)',
 '2026-10-22T20:00:02Z [Info]PawnIO module initialization aborted (unsupported)',
 '2026-10-22T20:00:03Z [Error][NetworkServer] recv_select failed receiving magic, closing listener',
 'SECRET C:\\Users\\PrivateUser PRIVATE-SERIAL'
].join('\n'));
const logResult=spawnSync(path.resolve('dist/diagnostics/NexusRGB-Diagnostic.exe'),['--log-fixture',logRoot],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(logResult.status,0,logResult.stderr);const hwLog=JSON.parse(logResult.stdout).find(row=>row.source==='hardware');assert.equal(hwLog.signatures['pawnio-module-load-failed'],2);assert.equal(hwLog.signatures['hresult-80070490'],2);assert.equal(hwLog.signatures['sdk-disconnected'],1);assert.doesNotMatch(logResult.stdout,/SECRET|PrivateUser|PRIVATE-SERIAL|2026-10-22/);
console.log('GPU log summary: coded initialization aborts and decimal HRESULT detected, unsupported probes excluded, no raw log content exported.');
async function apiTest(){
  const http=require('node:http'),{spawn}=require('node:child_process');let calls=[];
  const server=http.createServer((req,res)=>{
    calls.push(req.method+' '+req.url);res.setHeader('Content-Type','application/json');
    if(req.url==='/api/health')return res.end(JSON.stringify({application:'nexus-rgb'}));
    if(req.url==='/api/session/local'){
      assert.equal(req.method,'POST');assert.equal(req.headers['x-nexus-client'],'web');assert.equal(req.headers.origin,'http://127.0.0.1:'+server.address().port);
      res.setHeader('Set-Cookie','nexus_session=SECRET; HttpOnly; Path=/');return res.end('{}');
    }
    assert.equal(req.headers.cookie,'nexus_session=SECRET');
    if(req.url==='/api/state')return res.end(JSON.stringify(source));
    if(req.url==='/api/diagnostics')return res.end(JSON.stringify({build:source.build,health:{state:'ready'},render:{spatial:true,fps:20,requestedFps:20},errors:{controllerLost:false}}));
    res.statusCode=404;res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const proc=spawn(path.resolve('dist/diagnostics/NexusRGB-Diagnostic.exe'),['--api-fixture',String(server.address().port)],{windowsHide:true});let output='';proc.stdout.setEncoding('utf8');proc.stdout.on('data',v=>output+=v);
    const status=await new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('exit',resolve);});assert.equal(status,0);
    const report=JSON.parse(output);assert.equal(report.collection.application,'collected');assert.equal(report.engineSummary.renderedFps,20);assert.equal(report.build.tag,'v0.1.0-alpha.40');assert.equal(report.system,undefined);assert.equal(report.logSummary,undefined);assert.doesNotMatch(output,/SECRET|PRIVATE-SERIAL|private-parent|PrivateUser/);
    assert.deepEqual(calls,['GET /api/health','POST /api/session/local','GET /api/state','GET /api/diagnostics']);
    console.log('GPU collector loopback HTTP: local session stays private; read-only state/diagnostic requests only.');
  }finally{await new Promise(resolve=>server.close(resolve));}
}
apiTest().catch(error=>{console.error(error);process.exitCode=1;});
