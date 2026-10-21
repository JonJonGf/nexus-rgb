'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
for(const script of ['test-cooling-privilege.cjs','test-cooling-launch-service.cjs']){
 test('cooling launch contract: '+script,{skip:process.platform!=='win32'},()=>{
  const result=spawnSync(process.execPath,[path.resolve('scripts',script)],{encoding:'utf8',windowsHide:true,timeout:20000});
  assert.equal(result.status,0,result.stdout+result.stderr+String(result.error||''));
 });
}
