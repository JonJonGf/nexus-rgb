'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{FirstUse}=require('../server/first-use');
test('primeiro acesso é único entre sessões, reinícios e atualização com dados preservados',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-first-use-'));t.after(()=>{const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('nexus-first-use-'));fs.rmSync(absolute,{recursive:true,force:true})});
 const initial=new FirstUse(root);assert.equal(initial.seen,false);assert.equal(new FirstUse(root).seen,false);assert.equal(initial.take(),true);assert.equal(initial.take(),false);assert.equal(new FirstUse(root).take(),false);fs.writeFileSync(path.join(root,'settings.json'),'{}');assert.equal(new FirstUse(root).take(),false);
});
test('instalação existente sem marcador não mostra apresentação depois da atualização',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-first-use-'));t.after(()=>{const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('nexus-first-use-'));fs.rmSync(absolute,{recursive:true,force:true})});fs.writeFileSync(path.join(root,'settings.json'),'{}');assert.equal(new FirstUse(root).take(),false);assert.equal(new FirstUse(root).take(),false);
});
