'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const script=path.join(__dirname,'../scripts/benchmark-experiences.cjs');
function reject(args,pattern){const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stderr,pattern);}
test('experience benchmark rejects external module roots and output traversal before running a case',()=>{
  reject(['..','../outside.json'],/fixed paths/);
  reject(['child','../../server','unused'],/Unknown benchmark source/);
  reject(['snapshot','../outside.json'],/fixed paths/);
  reject(['child','candidate','../outside'],/Unknown benchmark source/);
});
