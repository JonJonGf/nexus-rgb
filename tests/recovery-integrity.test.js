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
test('quarantine of a long HTML effect survives reopening Studio',async t=>{
  const {directory,store,hardware}=fixture(t);let studio=new Studio(store,hardware,directory,()=>{});t.after(()=>studio.stop());
  const source='<title>Recovery fixture</title><canvas id="exCanvas" width="320" height="200"></canvas><script>'+('/*owned fixture*/'.repeat(500))+'</script>';
  const id=await studio.import(source);studio.configure({activeId:id,enabled:true});studio.fail('Synthetic failure');studio.stop();
  studio=new Studio(store,hardware,directory,()=>{});
  assert.equal(studio.recoverySnapshot().quarantined,true);
  assert.equal(studio.recoverySnapshot().message,'Synthetic failure');
});
