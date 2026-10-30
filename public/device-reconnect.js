'use strict';
(() => {
  const $=id=>document.getElementById(id),T=window.NexusI18n;
  let api,onApplied,notify,busy=false,review=null;
  const labels={power:'Energia',color:'Cor',brightness:'Brilho',speed:'Velocidade',effect:'Movimento',palette:'Paleta',nativeMode:'Modo interno',syncWithPc:'Sincronizar com o PC',zones:'Quantidade de LEDs ARGB'};
  function invalidate(){review=null;$('reconnect-summary').textContent='';$('reconnect-omissions').hidden=true;$('reconnect-accept').checked=false;buttons();}
  function buttons(){
    $('reconnect-from').disabled=busy;$('reconnect-to').disabled=busy;
    $('reconnect-review').disabled=busy;
    $('reconnect-apply').disabled=busy||!review||Boolean(review.omitted.length&&!$('reconnect-accept').checked);
  }
  async function run(work){
    if(busy)return;busy=true;$('reconnect-error').hidden=true;buttons();
    try{await work();}catch(error){$('reconnect-error').textContent=T(error.message);$('reconnect-error').hidden=false;}
    finally{busy=false;buttons();}
  }
  $('reconnect-device').addEventListener('click',()=>{
    invalidate();$('reconnect-dialog').showModal();
    run(async()=>{
      const data=await api('/api/devices/reconnect');
      for(const [id,items]of [['reconnect-from',data.sources],['reconnect-to',data.targets]]){
        const select=$(id);select.replaceChildren(new Option(T('Escolha…'),''));
        for(const item of items)select.append(new Option((item.name||T('Configuração salva'))+' · '+item.id.slice(0,8),item.id));
      }
      if(!data.sources.length)$('reconnect-summary').textContent=T('Nenhuma configuração desconectada para transferir.');
    });
  });
  for(const id of ['reconnect-from','reconnect-to'])$(id).addEventListener('change',invalidate);
  $('reconnect-accept').addEventListener('change',buttons);
  $('reconnect-review').addEventListener('click',()=>run(async()=>{
    review=await api('/api/devices/reconnect/review',{from:$('reconnect-from').value,to:$('reconnect-to').value});
    const settings=Object.entries(review.lighting||{}).map(([key,value])=>T(labels[key]||key)+': '+(typeof value==='boolean'?T(value?'Ligado':'Desligado'):Array.isArray(value)?value.join(', '):value));
    $('reconnect-summary').textContent=[T('Origem')+': '+(review.source||T('Configuração salva')+' '+review.from.slice(0,8)),T('Destino')+': '+review.target,...settings,T('Peças do mapa')+': '+review.layoutItems,T('Perfis')+': '+review.profileCount].join('\n');
    $('reconnect-omissions').hidden=!review.omitted.length;
    $('reconnect-omitted-fields').textContent=review.omitted.map(key=>T(labels[key]||key)).join(', ');
  }));
  $('reconnect-apply').addEventListener('click',()=>run(async()=>{
    const result=await api('/api/devices/reconnect/apply',{token:review.token,acceptOmissions:$('reconnect-accept').checked});
    $('reconnect-dialog').close();onApplied(result);notify(T('Configuração reconectada. Confira o resultado no dispositivo.'));invalidate();
  }));
  window.NexusReconnect={update(options){api=options.api;onApplied=options.onApplied;notify=options.notify;$('reconnect-device').hidden=!options.admin;}};
})();
