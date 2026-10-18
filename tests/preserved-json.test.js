'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {preserveJson}=require('../server/store');
test('preserved JSON stays inside its directory and never overwrites an existing entry',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-preserved-json-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const root=path.join(directory,'backups'),name='invalid-studio-'+ 'a'.repeat(24)+'.json';
  assert.equal(preserveJson(root,name,{original:true}),true);
  assert.equal(preserveJson(root,name,{original:false}),false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,name))),{original:true});
  assert.throws(()=>preserveJson(root,'../escaped.json',{}));
  assert.throws(()=>preserveJson(root,path.join(directory,'escaped.json'),{}));
  const outside=path.join(directory,'outside.json');fs.writeFileSync(outside,'sentinel');
  fs.linkSync(outside,path.join(root,'existing.json'));
  assert.equal(preserveJson(root,'existing.json',{replace:true}),false);
  assert.equal(fs.readFileSync(outside,'utf8'),'sentinel');
  assert.deepEqual(fs.readdirSync(root).sort(),['existing.json',name].sort());
});
