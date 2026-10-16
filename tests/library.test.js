'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../server/store'),{Studio,builtin}=require('../server/studio');
test('favoritos/categorias persistem e duplicação preserva perfil espacial e fonte original',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-library-')),store=new Store(directory),studio=new Studio(store,{snapshot:()=>({devices:[]}),changed(){}},directory,()=>{});t.after(()=>{studio.stop();fs.rmSync(directory,{recursive:true,force:true});});
  const p=store.profile('Original',undefined,{enabled:true,activeId:builtin[0].id,values:{},excluded:[]}),copy=store.duplicateProfile(p.id,'Cópia');assert.notEqual(p.id,copy.id);assert.deepEqual(copy.studio,p.studio);copy.master.color='#ff0000';assert.notEqual(p.master.color,copy.master.color);
  store.library({key:'profile:'+p.id,favorite:true,category:'Meu setup',transitionMs:300},['profile:'+p.id]);const reloaded=new Store(directory);assert.deepEqual(reloaded.data.library,{favorites:['profile:'+p.id],categories:{['profile:'+p.id]:'Meu setup'},transitionMs:300});assert.throws(()=>store.library({key:'__proto__',favorite:true},[]));assert.throws(()=>store.library({transitionMs:1001},[]));
  const id=await studio.duplicate(builtin[0].id,'Aurora pessoal');assert.notEqual(id,builtin[0].id);assert.equal(studio.effects.get(id).name,'Aurora pessoal');assert.equal(studio.effects.get(builtin[0].id).name,'Aurora espacial');
  assert.equal(await studio.import(JSON.stringify(builtin[0])),builtin[0].id);assert.equal(studio.effects.get(builtin[0].id).builtin,true);assert.equal(fs.existsSync(path.join(directory,'effects',builtin[0].id+'.json')),false);
});
