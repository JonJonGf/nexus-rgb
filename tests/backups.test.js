'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../server/store'),{Studio}=require('../server/studio'),{Backups}=require('../server/backup');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-backup-')),store=new Store(directory),hardware={snapshot:()=>({devices:[]}),changed(){},setFps(){},cancelIdentification(){}},studio=new Studio(store,hardware,directory,()=>{});t.after(()=>{studio.stop();fs.rmSync(directory,{recursive:true,force:true});});return {directory,store,studio,backups:new Backups(store,studio,directory)};}
const original=JSON.stringify({format:'nexus-effect/1',name:'Backup test',pattern:'gradient',palette:['#123456'],speed:0,angle:0,scale:1});
test('backup restaura configurações e imports, mantém biblioteca e cria cópia anterior',async t=>{
  const {store,studio,backups,directory}=fixture(t);const id=await studio.import(original);studio.configure({activeId:id,enabled:false});store.profile('Meu perfil');store.save();const backup=backups.export();store.data.profiles=[];store.performance({fps:40});
  const review=await backups.review(backup);assert.equal(review.summary.profiles,1);const result=backups.apply(review.token);assert.equal(store.data.profiles[0].name,'Meu perfil');assert.equal(store.data.performance,undefined);assert.equal(studio.effects.has(id),true);assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'backups',result.backup))).settings.performance.fps,40);assert.throws(()=>backups.apply(review.token));
  const builtin=require('../server/studio').builtin[0];const legacy=await backups.review({...backups.export(),effects:[...backups.files(),{id:builtin.id,original:JSON.stringify(builtin)}]});assert.equal(legacy.summary.imports,1);
});
test('revisão invalida mudanças concorrentes, campos maliciosos, limites e efeito sem validação',async t=>{
  const {store,studio,backups}=fixture(t);const backup=backups.export(),review=await backups.review(backup);store.master({color:'#ff0000'});assert.throws(()=>backups.apply(review.token),/mudaram/);assert.equal(store.data.master.color,'#ff0000');
  for(const bad of [{...backup,settings:{...backup.settings,devices:{'../../file':{power:false}}}},{...backup,effects:[{id:'a'.repeat(24),original:'<html>no canvas</html>'}]},{...backup,settings:{...backup.settings,profiles:Array(33).fill({})}},{...backup,settings:{...backup.settings,master:{power:'false'}}}])await assert.rejects(backups.review(bad));
  const parse=studio.parse(original);let probed=0;studio.probe=async()=>{probed++;throw Error('probe failure');};await assert.rejects(backups.review({...backup,effects:[{id:parse.id,original}]}),/probe failure/);assert.equal(probed,1);assert.equal(studio.effects.has(parse.id),false);assert.equal(backups.pending,null);
});
test('falha no commit de configurações preserva estado e remove somente novos imports',async t=>{
  const {store,studio,backups,directory}=fixture(t),before=structuredClone(store.data),parsed=studio.parse(original);const backup={...backups.export(),effects:[{id:parsed.id,original}]};const review=await backups.review(backup);
  const originalSave=store.save;store.save=function(){this.data=structuredClone(this.committed);throw Error('disk full');};assert.throws(()=>backups.apply(review.token),/disk full/);store.save=originalSave;assert.deepEqual(store.data,before);assert.equal(fs.existsSync(path.join(directory,'effects',parsed.id+'.json')),false);assert.equal(studio.effects.has(parsed.id),false);assert.equal(fs.readdirSync(path.join(directory,'backups')).length,1);
});
