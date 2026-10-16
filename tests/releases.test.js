'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{version,compare,select,check,endpoint}=require('../public/release-model');
const release=tag=>({tag_name:tag,draft:false,assets:['NexusRGB-Setup-0.1.0.exe','SHA256SUMS.txt','BUILD-INFO.json'].map(name=>({name,state:'uploaded',size:100})),html_url:'https://attacker.invalid/',body:'<script>malice</script>'});
test('comparação numérica de versões e canal estável não recuam para alphas',()=>{
  assert.equal(compare(version('v0.1.0-alpha.15'),version('v0.1.0-alpha.9')),1);assert.equal(version('v0.1.0-alpha.01'),null);assert.equal(version('v1.0.0/<script>'),null);
  assert.equal(select([release('v0.1.0-alpha.15')],'v0.1.0-alpha.14').newer,true);
  assert.equal(select([release('v0.1.0-alpha.15'),release('v0.1.0')],'v0.1.0').tag,'v0.1.0');
  assert.equal(select([release('v0.1.0-alpha.15')],null).newer,null);
  assert.equal(select([release('v0.1.0-alpha.15')],'v0.1.0-alpha.14').url,'https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.15');
  assert.throws(()=>select([{...release('v0.1.0'),draft:true}],null));assert.throws(()=>select([{...release('v0.1.0'),assets:[]}],null));
});
test('consulta usa só endpoint fixo, não envia credenciais e limita resposta',async()=>{
  let called=0;const result=await check(async(url,options)=>{called++;assert.equal(url,endpoint);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');return Response.json([release('v0.1.0-alpha.15')]);},'v0.1.0-alpha.14');
  assert.equal(called,1);assert.equal(result.newer,true);
  await assert.rejects(check(async()=>new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}}),null),/grande/);
  await assert.rejects(check(async()=>new Response('',{status:403}),null),/limitou/);
  await assert.rejects(check(async()=>new Response('<html>',{headers:{'content-type':'text/html'}}),null),/inválida/);
});
