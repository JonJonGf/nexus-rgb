'use strict';
window.NexusCodePreview={create({api,source,canvas,parameters,metadata,status,error,busy,profile=()=>null}){
  const T=window.NexusI18n;let stream,token,version=0,values={},original='';
  function stop(){version++;stream?.close();stream=null;if(token){const old=token;token=null;api('/api/studio/draft/'+old,undefined,'DELETE').catch(()=>{});}busy(false);}
  function changed(){stop();if(original!==source.value){values={};parameters.replaceChildren();metadata.textContent='';original=source.value;}status(T('Código alterado. Clique em Testar prévia para validar e executar.'));}
  function controls(effect){
    metadata.textContent=effect.name+' · '+effect.publisher;parameters.replaceChildren();
    for(const control of effect.controls){const label=document.createElement('label');label.textContent=control.label;let input;
      if(control.type==='combobox'){input=document.createElement('select');for(const v of control.values){const option=document.createElement('option');option.value=v;option.textContent=v;input.append(option);}}
      else{input=document.createElement('input');input.type=control.type==='boolean'?'checkbox':control.type==='color'?'color':'number';if(control.type==='number'){input.min=control.min;input.max=control.max;input.step='any';}}
      input.setAttribute('aria-label',control.label);if(control.type==='boolean')input.checked=values[control.key];else input.value=values[control.key];
      input.addEventListener('input',()=>{values[control.key]=control.type==='boolean'?input.checked:control.type==='number'?Number(input.value):input.value;stop();status(T('Parâmetro alterado. Clique em Testar prévia para reiniciar com este ajuste.'));});label.append(input);parameters.append(label);
    }
  }
  async function start(){
    stop();const turn=version;busy(true);
    try{
      const profileId=profile(),result=await api('/api/studio/draft',{source:source.value,values,...(profileId?{profileId}:{})},'POST');
      if(turn!==version){api('/api/studio/draft/'+result.token,undefined,'DELETE').catch(()=>{});return;}
      token=result.token;values=result.values;original=source.value;controls(result.effect);stream=new EventSource('/api/studio/draft/'+token);
      const fail=message=>{if(turn!==version)return;stop();error(message);};
      stream.addEventListener('draft-error',event=>{try{fail(T(JSON.parse(event.data).error));}catch{fail(T('Falha na prévia do código.'));}});
      stream.onerror=()=>fail(T('A prévia foi encerrada. Clique em Testar prévia novamente.'));
      stream.onmessage=event=>{
        if(turn!==version||document.hidden)return;
        try{const frame=JSON.parse(event.data);if(typeof frame.image!=='string'||frame.image.length>710000)throw Error();const image=new Image();image.onload=()=>{if(turn===version){canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);}};image.src='data:image/png;base64,'+frame.image;}catch{fail(T('Falha na prévia do código.'));}
      };
      status(T('Prévia isolada do HTML. Não salva nem altera as luzes. Ao retomar, o código reinicia.'));
    }catch(e){if(turn===version)error(T(e.message));}finally{if(turn===version)busy(false);}
  }
  return {start,stop,changed,seed(next,effect){stop();values={...next};original=source.value;controls(effect);},values:()=>({...values}),playing:()=>Boolean(stream)};
}};
