'use strict';
(() => {
  const T=window.NexusI18n,$=id=>document.getElementById(id);let build;
  fetch('/api/about',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{build=data; $('update-installed').textContent=T('Versão instalada: ')+(data.tag||T('Desenvolvimento'))+' · '+(data.commit?.slice(0,12)||data.version);$('update-check').disabled=false;}).catch(()=>{$('update-result').textContent=T('Abra o painel para iniciar a sessão local e tente novamente.');});
  $('update-check').addEventListener('click',async()=>{
    $('update-check').disabled=true;$('update-download').hidden=true;$('update-result').textContent=T('Consultando GitHub…');
    try{const release=await NexusReleases.check(fetch,build.tag);$('update-result').textContent=T(release.newer===null?'Build de desenvolvimento. Versão disponível: ':release.newer?'Nova versão disponível: ':'Sua versão está atualizada. Disponível: ')+release.tag;const link=$('update-download');link.href=release.url;link.hidden=false;}
    catch(error){$('update-result').textContent=T(['AbortError','TypeError'].includes(error.name)?'Consulta indisponível. Confira a conexão ou tente mais tarde.':error.message);}
    finally{$('update-check').disabled=false;}
  });
})();
