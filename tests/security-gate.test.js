'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{checkSecurity}=require('../scripts/check-security-gate.cjs');
const context={repository:'JonJonGf/nexus-rgb',ref:'refs/tags/v0.1.0-alpha.17',commit:'a'.repeat(40),token:'fixture-not-a-token'};
const analyses=()=>['actions','javascript-typescript','csharp'].map(language=>({category:'/language:'+language,ref:context.ref,commit_sha:context.commit,environment:JSON.stringify({'build-mode':language==='csharp'?'manual':'none'}),error:'',warning:''}));
function request(rows=analyses(),alerts=[]){return async(url,options)=>{assert.equal(new URL(url).host,'api.github.com');assert.equal(options.redirect,'error');return {ok:true,json:async()=>url.includes('/analyses?')?rows:alerts};};}
test('publicação exige as três análises do mesmo commit/tag e nenhum alerta aberto',async()=>{
 const report=await checkSecurity({...context,request:request()});assert.equal(report.openAlerts,0);assert.equal(report.languages,3);assert.equal(JSON.stringify(report).includes(context.token),false);
 for(const rows of [analyses().slice(0,2),analyses().map(a=>({...a,commit_sha:'b'.repeat(40)})),analyses().map(a=>({...a,ref:'refs/heads/main'}))])await assert.rejects(checkSecurity({...context,request:request(rows)}),/ausente/);
 await assert.rejects(checkSecurity({...context,request:request(analyses(),[{number:99}])}),/alertas/);
});
test('aviso, erro de extração, C# sem build ou indisponibilidade bloqueiam publicação',async()=>{
 for(const patch of [{warning:'low quality'},{error:'extraction failure'},{environment:'{"build-mode":"none"}'}]){const rows=analyses();Object.assign(rows[2],patch);await assert.rejects(checkSecurity({...context,request:request(rows)}));}
 await assert.rejects(checkSecurity({...context,request:async()=>({ok:false,status:403})}),/HTTP 403/);
 let called=false;await assert.rejects(checkSecurity({...context,ref:'refs/heads/main',request:async()=>{called=true}}),/inválido/);assert.equal(called,false);
});
