'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../server/store'),{Studio}=require('../server/studio');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-integrity-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const store=new Store(directory),hardware={connected:false,snapshot:()=>({devices:[]}),changed(){}};return {directory,store,hardware};}
test('invalid saved map keeps the panel available without overwriting the original settings',t=>{
  const {directory,store,hardware}=fixture(t);store.data.studio={enabled:true,layout:[{bad:true}]};store.save();const original=fs.readFileSync(store.file,'utf8');
  const studio=new Studio(store,hardware,directory,()=>{});t.after(()=>studio.stop());
  assert.equal(studio.recoverySnapshot().kind,'config');assert.deepEqual(studio.snapshot(true).layout,[]);
  assert.equal(fs.readFileSync(store.file,'utf8'),original);
});

test('retry and last-working never replace an invalid map before explicit layout review',async t=>{
  const {directory,store,hardware}=fixture(t);
  store.data.studio={enabled:true,layout:[{key:'recoverable-position',x:0.37,count:-1}]};store.save();
  const original=fs.readFileSync(store.file,'utf8'),studio=new Studio(store,hardware,directory,()=>{});t.after(()=>studio.stop());
  for(const action of ['retry','last-working']){
    await assert.rejects(studio.recover(action),{status:409});
    assert.equal(fs.readFileSync(store.file,'utf8'),original);
    assert.deepEqual(studio.recoverySnapshot().actions,['lights-off']);
  }
  studio.configure({layout:[],enabled:false});
  const preserved=fs.readdirSync(directory).find(f=>f.startsWith('invalid-studio-'));
  assert(preserved);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,preserved))),JSON.parse(original).studio);
  assert.equal(studio.snapshot().enabled,false);
});
test('quarantine of a long HTML effect survives reopening Studio',async t=>{
  const {directory,store,hardware}=fixture(t);let studio=new Studio(store,hardware,directory,()=>{});t.after(()=>studio.stop());
  const source='<title>Recovery fixture</title><canvas id="exCanvas" width="320" height="200"></canvas><script>'+('/*owned fixture*/'.repeat(500))+'</script>';
  const id=await studio.import(source);studio.configure({activeId:id,enabled:true});studio.fail('Synthetic failure');studio.stop();
  studio=new Studio(store,hardware,directory,()=>{});
  assert.equal(studio.recoverySnapshot().quarantined,true);
  assert.equal(studio.recoverySnapshot().message,'Synthetic failure');
});
