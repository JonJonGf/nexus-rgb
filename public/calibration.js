'use strict';
window.NexusCalibration = {create(hooks) {
  const T=window.NexusI18n, $=id=>document.getElementById(id);
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=T(text);e.dataset.i18n=text;}if(cls)e.className=cls;return e;};
  const button=make('button','Calibrar peça…','button subtle');button.type='button';button.id='map-calibrate';$('studio-device-form').append(button);
  const start=make('button','Conferir meu primeiro componente','button primary');start.type='button';start.id='studio-setup-wizard';$('studio-selection-note').append(start);start.addEventListener('click',()=>{hooks.selectFirst();if(hooks.item())button.click();});
  const dialog=make('dialog',undefined,'studio-formula-dialog calibration-dialog');dialog.id='calibration-dialog';dialog.setAttribute('aria-labelledby','calibration-title');
  const form=make('form',undefined,'studio-formula'),head=make('div',undefined,'formula-heading'),title=make('h2','Calibrar peça');title.id='calibration-title';
  const close=make('button','Fechar','text-button');close.type='button';head.append(title,close);
  const body=make('div',undefined,'formula-body'),intro=make('p','A forma e a ordem física precisam corresponder à peça real. O teste acende somente o componente escolhido por até 3 segundos, com brilho reduzido.','muted small');
  const info=make('p',undefined,'calibration-info'),scope=make('p','Este assistente ajusta o mapa. A quantidade disponível vem do OpenRGB; ele não redimensiona portas nem detecta a fiação.','muted small');
  const field=(text,input)=>{const l=make('label');l.append(make('span',text),input);return l;};
  const wiring=make('select');wiring.id='calibration-wiring';for(const [value,text] of [['unknown','Ligação não confirmada'],['sequential','LEDs independentes em sequência'],['mirrored','Sinal replicado / espelhado']]){const o=make('option',text);o.value=value;wiring.append(o);}
  const explain=make('p','Se várias ventoinhas repetem o mesmo sinal, elas não podem receber cores independentes pelo mesmo conector.','muted small');
  const identify=make('button','Identificar componente','button subtle'),led=make('input'),test=make('button','Testar LED','button subtle'),stop=make('button','Parar teste','text-button');identify.type=test.type=stop.type='button';identify.id='calibration-identify';test.id='calibration-test';stop.id='calibration-stop';led.id='calibration-led';led.type='number';led.min='1';
  const probe=make('div',undefined,'calibration-probe');probe.append(identify,field('LED físico (a partir de 1)',led),test,stop);
  const fan=make('section'),rings=make('div'),add=make('button','Adicionar anel','button subtle');add.type='button';add.id='calibration-add-ring';rings.id='calibration-rings';
  fan.append(make('h3','Anéis da ventoinha'),make('p','Informe os anéis de fora para dentro. O primeiro LED de cada anel começa no topo; ajuste o deslocamento e o sentido conforme o teste físico. A soma deve usar todos os LEDs da peça.','muted small'),rings,add);
  const advanced=make('details'),order=make('textarea');order.id='calibration-order';order.rows=3;order.maxLength=24000;advanced.append(make('summary','Ordem física personalizada'),field('Índices físicos, na ordem do desenho (1, 2, 3…). Vazio usa a ordem padrão.',order));
  const error=make('p',undefined,'error');error.id='calibration-error';error.setAttribute('role','status');
  const foot=make('div',undefined,'formula-footer'),save=make('button','Salvar calibração','button primary');save.id='calibration-save';save.type='submit';foot.append(save);
  body.append(intro,info,scope,field('Tipo de ligação',wiring),explain,probe,fan,advanced,error);form.append(head,body,foot);dialog.append(form);document.body.append(dialog);
  let key,id,revision,busy=false,rows=[];
  function entries() {return rows.map(r=>({count:Number(r.count.value),offset:Number(r.offset.value),reverse:r.reverse.checked}));}
  function render(values) {
    rows=[];rings.replaceChildren();
    values.forEach((value,index)=>{const row=make('div',undefined,'calibration-ring'),count=make('input'),offset=make('input'),reverse=make('input'),remove=make('button','Remover','text-button');count.type=offset.type='number';count.min='1';count.max='4096';offset.min='0';offset.max='4095';count.value=value.count;offset.value=value.offset;reverse.type='checkbox';reverse.checked=value.reverse;remove.type='button';remove.disabled=values.length===1;
      row.append(make('strong',String(index+1)),field('LEDs',count),field('Deslocamento',offset),field('Inverter sentido',reverse),remove);rows.push({count,offset,reverse});remove.addEventListener('click',()=>render(entries().filter((_,i)=>i!==index)));rings.append(row);
    });add.disabled=values.length>=8;
  }
  async function command(payload) {if(busy||!id)return;busy=true;identify.disabled=test.disabled=true;error.textContent='';try{await hooks.api('/api/devices/'+id+'/identify',payload,'POST');}catch(e){error.textContent=T(e.message);}finally{busy=false;identify.disabled=test.disabled=false;}}
  function end() {if(id)hooks.api('/api/devices/'+id+'/identify',{stop:true},'POST').catch(()=>{});}
  identify.addEventListener('click',()=>command({}));test.addEventListener('click',()=>{if(!led.reportValidity())return;command({led:Number(led.value)-1});});stop.addEventListener('click',end);
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',end);window.addEventListener('pagehide',end);
  add.addEventListener('click',()=>render([...entries(),{count:1,offset:0,reverse:false}]));
  button.addEventListener('click',()=>{const entry=hooks.item();if(!entry)return;key=entry.key;id=entry.deviceId;revision=JSON.stringify(entry);const device=hooks.devices().find(d=>d.id===id);info.textContent=entry.name+' · '+entry.count+' LEDs · '+(entry.start+1)+'–'+(entry.start+entry.count)+(device?' / '+device.ledCount:'');wiring.value=entry.wiring||'unknown';led.max=String(device?.ledCount||entry.start+entry.count);led.value=entry.start+1;error.textContent='';fan.hidden=entry.shape!=='fan';render(entry.rings||[{count:entry.count,offset:0,reverse:false}]);order.value=entry.ledOrder?.map(n=>n+1).join(', ')||'';dialog.showModal();});
  form.addEventListener('submit',e=>{e.preventDefault();const entry=hooks.item();try{if(!entry||entry.key!==key||JSON.stringify(entry)!==revision)throw Error('A peça mudou enquanto a calibração estava aberta. Abra novamente para revisar.');const calibrated=window.NexusMapModel.calibration(entry.count,fan.hidden?[{count:entry.count,offset:0,reverse:false}]:entries(),order.value);delete entry.ledOrder;Object.assign(entry,calibrated,{wiring:wiring.value});if(fan.hidden)delete entry.rings;hooks.save();dialog.close();}catch(err){error.textContent=T(err.message);}});
  return {update(admin){button.hidden=start.hidden=!admin;}};
}};
