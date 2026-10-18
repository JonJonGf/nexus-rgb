'use strict';
async function checkSecurity({repository,ref,commit,token,request=fetch}) {
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository||'')||!/^refs\/tags\/v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(ref||'')||!/^[a-f0-9]{40}$/.test(commit||'')||!token)throw Error('Contexto de publicação de segurança inválido.');
  async function read(path){const response=await request('https://api.github.com/repos/'+repository+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Não foi possível conferir segurança: HTTP '+response.status);return response.json();}
  const query='?ref='+encodeURIComponent(ref),analyses=await read('/code-scanning/analyses'+query+'&per_page=100');
  if(!Array.isArray(analyses))throw Error('Resposta de análises inválida.');
  for(const language of ['actions','javascript-typescript','csharp']){
    const analysis=analyses.find(a=>a.category==='/language:'+language&&a.ref===ref&&a.commit_sha===commit);
    if(!analysis||analysis.error||analysis.warning)throw Error('Análise de segurança ausente ou incompleta: '+language);
    if(language==='csharp'){let environment;try{environment=JSON.parse(analysis.environment)}catch{}if(environment?.['build-mode']!=='manual')throw Error('C# precisa de compilação acompanhada pelo CodeQL.');}
  }
  const alerts=await read('/code-scanning/alerts'+query+'&state=open&per_page=1');
  if(!Array.isArray(alerts)||alerts.length)throw Error('Publicação bloqueada: existem alertas de código abertos ou a resposta é inválida.');
  return {repository,ref,commit,languages:3,openAlerts:0};
}
if(require.main===module){
  (async()=>{let result;for(let attempt=0;attempt<24;attempt++){try{result=await checkSecurity({repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,commit:process.env.GITHUB_SHA,token:process.env.GH_TOKEN});break;}catch(error){if(!error.message.startsWith('Análise de segurança ausente')||attempt===23)throw error;await new Promise(resolve=>setTimeout(resolve,5000));}}console.log(JSON.stringify(result));})().catch(error=>{console.error(error.message);process.exitCode=1});
}
module.exports={checkSecurity};
