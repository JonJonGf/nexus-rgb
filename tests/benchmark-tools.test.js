'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const script=path.join(__dirname,'../scripts/benchmark-experiences.cjs');
function reject(args,pattern){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stderr,pattern);}
test('experience benchmark rejects external module roots and output traversal before running a case',t=>{
  reject(['..','../outside.json'],/baseline folder under data/);
  reject(['child','../../server','unused'],/Unknown benchmark source/);
  const root=path.resolve(__dirname,'../data');fs.mkdirSync(root,{recursive:true});const snapshot=fs.mkdtempSync(path.join(root,'benchmark-test-'));
  t.after(()=>{if(path.dirname(snapshot)!==root||!path.basename(snapshot).startsWith('benchmark-test-'))throw Error('Unexpected fixture folder.');fs.rmSync(snapshot,{recursive:true,force:true});});
  reject([path.basename(snapshot),'../outside.json'],/simple JSON report filename/);
});
