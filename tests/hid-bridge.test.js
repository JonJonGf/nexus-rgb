'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {HidBridge}=require('../server/controllers/hid-bridge');
const {spawn}=require('node:child_process'),path=require('node:path');
// OS-process adapter: exercises the production protocol without opening a HID handle.
function processAdapter(){
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stdin=new EventEmitter();child.stdin.write=line=>{
    const command=JSON.parse(line);
    setImmediate(()=>child.stdout.emit('data',Buffer.from(JSON.stringify(command.action==='enumerate'?[{path:'synthetic-hid',vid:'0x258A',pid:'0x00EC',featLen:65}]:{status:'ok'})+'\n')));
    return true;
  };child.kill=()=>{};return child;
}
test('HID discovery waits for ready and returns the devices reported by the native process',async t=>{
  const child=processAdapter(),bridge=new HidBridge({isTest:false,binaryPath:__filename,spawnProcess:()=>child});t.after(()=>bridge.stop());
  const discovery=bridge.enumerate();
  child.stdout.emit('data',Buffer.from('{"status":"ready"}\n'));
  assert.deepEqual(await discovery,[{path:'synthetic-hid',vid:'0x258A',pid:'0x00EC',featLen:65}]);
});
test('HID rejects a native error, bounds a stopped consumer and terminates timed-out commands',async t=>{
  const child=processAdapter();child.stdin.write=()=>false;
  const bridge=new HidBridge({isTest:false,binaryPath:__filename,spawnProcess:()=>child,timeoutMs:30,maxPending:2});t.after(()=>bridge.stop());
  const first=bridge.sendFeatureReport('synthetic-device',Buffer.alloc(65));
  const second=bridge.sendFeatureReport('synthetic-device',Buffer.alloc(65));
  const timedOut=Promise.allSettled([first,second]);
  await assert.rejects(bridge.sendFeatureReport('synthetic-device',Buffer.alloc(65)),/fila USB/);
  child.stdout.emit('data',Buffer.from('{"status":"ready"}\n'));
  child.stdout.emit('data',Buffer.from('{"status":"error","message":"set_feature_failed"}\n'));
  const replies=await timedOut;
  assert.equal(replies[0].status,'rejected');assert.match(replies[0].reason.message,/set_feature_failed/);
  assert.equal(replies[1].status,'rejected');assert.match(replies[1].reason.message,/prazo/);
});
test('bridge exchanges enumeration and acknowledgements with an actual isolated process',async t=>{
  const bridge=new HidBridge({isTest:false,binaryPath:process.execPath,spawnProcess:(file,_args,options)=>spawn(file,[path.join(__dirname,'fixtures/hid-protocol-worker.cjs')],options)});t.after(()=>bridge.stop());
  const devices=await bridge.enumerate();assert.equal(devices[0].path,'synthetic-device');
  assert.equal(await bridge.sendFeatureReport(devices[0].path,Buffer.alloc(65)),true);
  await assert.rejects(bridge.sendFeatureReport('unavailable',Buffer.alloc(65)),/open_failed/);
});
