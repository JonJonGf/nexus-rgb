'use strict';
(() => {
  const $=id=>document.getElementById(id),T=window.NexusI18n;
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let api,admin=false,current=false,data,busy=false,timer,signature='',rows=new Map(),profileSignature='',librarySignature='',pendingPreset=null,shared=null,previewSignature='',previewCurveSignature='',sourceReadingId=0;
  function problem(error){$('cooling-error').textContent=T(error.message||error);$('cooling-error').hidden=false;}
  async function change(route,body){
    if(busy)return;busy=true;drawStatus();$('cooling-error').hidden=true;
    try{data=await api(route,body);draw();return data;}catch(error){problem(error);}
    finally{busy=false;drawStatus();if(!current&&data?.mode==='monitoring')change('/api/cooling',{enabled:false});else schedule();}
  }
  function schedule(){clearTimeout(timer);if(current&&!document.hidden&&data?.mode!=='off')timer=setTimeout(refresh,1000);}
  async function refresh(){
    if(!api||!admin||busy)return;
    try{data=await api('/api/cooling');draw();}catch(error){problem(error);}finally{schedule();}
  }
  function input(type,value,min,max){const e=make('input');e.type=type;if(value!==undefined)e.value=value;if(min!==undefined)e.min=min;if(max!==undefined)e.max=max;return e;}
  function field(label,control){const e=make('label',undefined,'cooling-field');e.append(make('span',T(label)),control);return e;}
  function select(label,items,value){const e=make('select');e.setAttribute('aria-label',T(label));e.append(new Option(T('Escolha…'),''));for(const item of items)e.append(new Option(item.name,item.id));e.value=value||'';return e;}
  function createSources(label,saved){
    const ids=saved?.sensorIds||[saved?.sensorId],container=make('div',undefined,'cooling-sources');
    function source(label,id,removable=false){
      const sensor=select(label,data.sensors,id),line=make('div',undefined,'cooling-source-row'+(removable?' with-remove':''));
      const reading=make('span','—','cooling-source-reading');reading.id='cooling-reading-'+(++sourceReadingId);sensor.setAttribute('aria-describedby',reading.id);
      const control=field(removable?'Sensor adicional':label,sensor);control.firstChild.className='cooling-source-heading';control.firstChild.append(reading);line.append(control);
      sensor.addEventListener('change',()=>updateSources(sources));return {sensor,line,reading};
    }
    const first=source(label,ids[0]),primary=first.sensor,extra=make('div',undefined,'cooling-source-extra'),entries=[],summary=make('p','', 'muted small cooling-source-summary');
    const sources={container,primary,entries,first,summary};
    const add=make('button',T('Adicionar sensor'),'button subtle');add.type='button';
    function append(id){
      if(entries.length>=7)return;
      const entry=source('Sensor adicional de temperatura',id,true),remove=make('button','×','button subtle cooling-remove-source');remove.type='button';remove.setAttribute('aria-label',T('Remover sensor'));remove.title=T('Remover sensor');
      entries.push(entry);entry.line.append(remove);extra.append(entry.line);
      remove.addEventListener('click',()=>{entries.splice(entries.indexOf(entry),1);entry.line.remove();add.disabled=false;updateSources(sources);});
      add.disabled=entries.length>=7;updateSources(sources);
    }
    for(const id of ids.slice(1))append(id);
    add.addEventListener('click',()=>append());
    container.append(first.line,extra,add,summary);updateSources(sources);return sources;
  }
  function updateSources(sources){
    const entries=[sources.first,...sources.entries],values=entries.map(entry=>data.sensors.find(s=>s.id===entry.sensor.value)?.value);
    const valid=value=>Number.isFinite(value)&&value>=-20&&value<=150;
    const complete=entries.every(entry=>entry.sensor.value)&&values.every(valid),maximum=complete?Math.max(...values):null;
    entries.forEach((entry,index)=>{
      entry.reading.textContent=valid(values[index])?Math.round(values[index])+' °C':entry.sensor.value?T('Indisponível'):'—';
      entry.reading.classList.toggle('is-hottest',complete&&entries.length>1&&values[index]===maximum);
      entry.sensor.title=entry.sensor.selectedOptions[0]?.textContent||'';
    });
    sources.summary.hidden=entries.length<2;
    sources.summary.textContent=complete?T('Maior selecionada: {0} °C',Math.round(maximum)):T('Escolha sensores válidos para comparar as temperaturas.');
  }
  function readSources(sources){
    const ids=[sources.primary.value,...sources.entries.map(entry=>entry.sensor.value)];
    if(ids.some(id=>!id))throw Error('Escolha um sensor para cada canal selecionado.');
    if(new Set(ids).size!==ids.length)throw Error('Selecione sensores diferentes.');
    return {sensorId:ids[0],...(ids.length>1?{sensorIds:ids}:{})};
  }
  function curveSettings(row){return row.custom.value==='manual'?{points:row.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).sort((a,b)=>a[0]-b[0]),interpolation:row.interpolation.value}:{};}
  function sharedSettings(manual=true){
    if(!$('cooling-linked').checked)return null;
    return {...readSources(shared.sources),minPercent:Number(shared.minimum.value),critical:Number(shared.critical.value),...(manual?curveSettings(shared):{})};
  }
  function linkedMode(){
    const linked=$('cooling-linked').checked;$('cooling-group').hidden=!linked;
    for(const row of rows.values()){for(const element of row.article.querySelectorAll('.cooling-independent'))element.hidden=linked;if(!linked)updateSources(row.sources);}
  }
  function createShared(force=false){
    const saved=data.group;
    if(!saved&&!force){shared=null;$('cooling-group').replaceChildren();$('cooling-linked').checked=false;linkedMode();return;}
    const selected=data.enabled&&data.resumeProfile?data.resumeProfile:data.profiles.find(p=>p.id===data.profile);
    const sources=createSources('Sensor de temperatura do grupo',saved),minimum=input('number',saved?.minPercent??40,20,100),critical=input('number',saved?.critical??85,60,100);
    shared=Object.assign(createCurve(saved?.points||selected.points,Boolean(saved?.points),saved?.interpolation||selected.interpolation||'linear'),{sources,minimum,critical});
    const fields=make('div',undefined,'cooling-fields');fields.append(sources.container,field('Mínimo (%)',minimum),field('Proteção térmica (°C)',critical));
    const save=make('button',T('Salvar como perfil personalizado'),'button subtle');save.type='button';save.addEventListener('click',()=>editPreset(null,shared.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]),shared.interpolation.value));
    $('cooling-group').replaceChildren(make('h3',T('Curva compartilhada')),make('p',T('Escolha os canais abaixo. Todos seguem a mesma curva; os limites de cada canal continuam valendo. RPM pode variar entre fans.'),'muted small'),fields,shared.container,save);
    $('cooling-linked').checked=Boolean(saved)||force;linkedMode();
  }
  function graph(row){
    const points=row.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).filter(p=>p.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]);
    const plotted=window.NexusCoolingModel.plot(points,row.interpolation.value);
    row.line.setAttribute('points',plotted.map(([x,y])=>`${10+(x-20)*3.5},${140-y*1.3}`).join(' '));
    row.handles.replaceChildren();row.points.forEach((p,i)=>{const dot=document.createElementNS(row.svg.namespaceURI,'circle');dot.setAttribute('cx',10+(Number(p.temperature.value)-20)*3.5);dot.setAttribute('cy',140-Number(p.percent.value)*1.3);dot.setAttribute('r','5');dot.dataset.point=String(i);row.handles.append(dot);});
  }
  function addPoint(row,point){
    const temperature=input('number',point[0],20,100),percent=input('number',point[1],20,100),tr=make('tr');
    temperature.setAttribute('aria-label',T('Temperatura do ponto'));percent.setAttribute('aria-label',T('Velocidade do ponto'));
    const remove=make('button',T('Remover'),'button subtle');remove.type='button';
    const entry={temperature,percent};for(const e of [temperature,percent,remove]){const td=make('td');td.append(e);tr.append(td);}row.table.append(tr);row.points.push(entry);
    remove.addEventListener('click',()=>{if(row.points.length<=2)return;row.points=row.points.filter(p=>p!==entry);tr.remove();graph(row);});
    for(const e of [temperature,percent])e.addEventListener('input',()=>{row.custom.value='manual';row.editor.hidden=false;graph(row);});
  }
  function createGraph(){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 -6 300 170');svg.setAttribute('class','cooling-graph');svg.setAttribute('role','img');svg.setAttribute('aria-label',T('Curva de temperatura e velocidade'));
    for(const y of [10,42.5,75,107.5,140]){const grid=document.createElementNS(svg.namespaceURI,'line');grid.setAttribute('x1','10');grid.setAttribute('x2','290');grid.setAttribute('y1',y);grid.setAttribute('y2',y);svg.append(grid);}for(const [x,y,label]of [[10,8,'100%'],[10,155,'0%'],[42,155,'20 °C'],[257,155,'100 °C']]){const text=document.createElementNS(svg.namespaceURI,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.textContent=label;svg.append(text);}
    const line=document.createElementNS(svg.namespaceURI,'polyline'),handles=document.createElementNS(svg.namespaceURI,'g');svg.append(line,handles);
    return {svg,line,handles};
  }
  function drawPreview(){
    const selection=$('cooling-preview-profile'),next=JSON.stringify(data.profiles);
    if(next!==previewSignature){previewSignature=next;const value=selection.value;selection.replaceChildren(...data.profiles.map(p=>new Option(p.custom?p.name:T(p.name),p.id)));selection.value=data.profiles.some(p=>p.id===value)?value:data.profile;}
    const preset=data.profiles.find(p=>p.id===selection.value);if(!preset)return;
    const curveSignature=JSON.stringify([preset,T('Curva de temperatura e velocidade')]);if(curveSignature===previewCurveSignature)return;previewCurveSignature=curveSignature;
    const {svg,line}=createGraph(),model=window.NexusCoolingModel,points=[[20,model.valueAt(preset.points,20,preset.interpolation)],...preset.points,[100,model.valueAt(preset.points,100,preset.interpolation)]];
    line.setAttribute('points',model.plot(points.filter((p,i)=>!i||p[0]!==points[i-1][0]),preset.interpolation).map(([x,y])=>`${10+(x-20)*3.5},${140-y*1.3}`).join(' '));
    $('cooling-preview-graph').replaceChildren(svg);
  }
  function createCurve(points,manual,mode='linear'){
    const container=make('div'),detail=make('div',undefined,'cooling-curve-editor'),custom=make('select');custom.setAttribute('aria-label',T('Modo de controle'));custom.append(new Option(T('Seguir perfil selecionado'),'profile'),new Option(T('Curva manual'),'manual'));custom.value=manual?'manual':'profile';detail.hidden=custom.value!=='manual';container.append(field('Modo de controle',custom));
    custom.addEventListener('change',()=>{detail.hidden=custom.value!=='manual';});
    const interpolation=make('select');interpolation.setAttribute('aria-label',T('Traçado da curva'));interpolation.append(new Option(T('Linear'),'linear'),new Option(T('Suave'),'smooth'));interpolation.value=mode;
    const {svg,line,handles}=createGraph();
    const table=make('table'),head=make('thead'),headers=make('tr'),body=make('tbody');for(const label of ['Temperatura (°C)','Velocidade (%)',''])headers.append(make('th',T(label)));head.append(headers);table.append(head,body);
    const row={container,custom,interpolation,editor:detail,table:body,line,svg,handles,points:[]};interpolation.addEventListener('change',()=>graph(row));
    for(const point of points)addPoint(row,point);
    const add=make('button',T('Adicionar ponto'),'button subtle');add.type='button';add.addEventListener('click',()=>{if(row.points.length>=8)return;let slot=0;for(let i=1;i<row.points.length-1;i++)if(Number(row.points[i+1].temperature.value)-Number(row.points[i].temperature.value)>Number(row.points[slot+1].temperature.value)-Number(row.points[slot].temperature.value))slot=i;const a=row.points[slot],b=row.points[slot+1],point=[Math.round((Number(a.temperature.value)+Number(b.temperature.value))/2),Math.round((Number(a.percent.value)+Number(b.percent.value))/2)];if(point[0]<=Number(a.temperature.value)||point[0]>=Number(b.temperature.value))return;addPoint(row,point);row.points.sort((a,b)=>Number(a.temperature.value)-Number(b.temperature.value));for(const p of row.points)body.append(p.temperature.closest('tr'));graph(row);});
    let dragged=null;svg.addEventListener('pointerdown',event=>{if(event.target.dataset.point===undefined)return;dragged=Number(event.target.dataset.point);svg.setPointerCapture(event.pointerId);event.preventDefault();});
    svg.addEventListener('pointermove',event=>{if(dragged===null)return;const matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix.inverse()),p=row.points[dragged],previous=row.points[dragged-1],next=row.points[dragged+1];p.temperature.value=Math.round(Math.max(previous?Number(previous.temperature.value)+1:20,Math.min(next?Number(next.temperature.value)-1:100,20+(local.x-10)/3.5)));p.percent.value=Math.round(Math.max(previous?Number(previous.percent.value):20,Math.min(next?Number(next.percent.value):100,(140-local.y)/1.3)));graph(row);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(event,()=>{dragged=null;});
    detail.append(field('Traçado da curva',interpolation),make('p',T('Arraste os pontos ou digite os valores. Salve para aplicar.'),'muted small'),svg,table,add);container.append(detail);graph(row);return row;
  }
  function channel(control){
    const saved=data.assignments.find(a=>a.controlId===control.id),article=make('article',undefined,'panel cooling-channel');
    const title=make('h3',control.name),enabled=input('checkbox');enabled.checked=Boolean(saved);enabled.setAttribute('aria-label',T('Controlar este canal'));article.dataset.control=control.id;
    const enable=make('label',undefined,'cooling-check');enable.append(enabled,make('span',T('Controlar este canal')));article.append(title,enable);
    const original=make('p',control.originalName||control.name,'muted small');article.append(original);
    const identity=make('p',undefined,'muted small');article.append(identity);
    enabled.addEventListener('change',filterChannels);
    const output=make('p','', 'cooling-output');article.append(output);
    const sources=createSources('Sensor de temperatura',saved),sensor=sources.primary,rpm=select('Leitura de RPM',data.fans,saved?.rpmId);
    rpm.addEventListener('change',draw);
    const minimum=input('number',saved?.minPercent??Math.max(control.limits.minimum,Math.min(control.limits.maximum,40)),control.limits.minimum,control.limits.maximum),critical=input('number',saved?.critical??85,60,100);
    const fields=make('div',undefined,'cooling-fields'),minField=field('Mínimo (%)',minimum),criticalField=field('Proteção térmica (°C)',critical),rpmField=field('Leitura de RPM',rpm);rpmField.classList.add('cooling-rpm-field');for(const element of [sources.container,minField,criticalField])element.classList.add('cooling-independent');fields.append(sources.container,rpmField,minField,criticalField);article.append(fields);
    const selected=data.enabled&&data.resumeProfile?data.resumeProfile:data.profiles.find(p=>p.id===data.profile),row=Object.assign(createCurve(saved?.points||selected.points,Boolean(saved?.points),saved?.points?saved.interpolation||'linear':selected.interpolation||'linear'),{control,article,title,original,identity,enabled,sources,sensor,rpm,minimum,critical,output});row.container.classList.add('cooling-independent');article.append(row.container);
    const save=make('button',T('Salvar como perfil personalizado'),'button subtle cooling-independent');save.type='button';save.addEventListener('click',()=>editPreset(null,row.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]),row.interpolation.value));article.append(save);
    const identification=make('details'),summary=make('summary',T('Identificar canal')),name=input('text'),hidden=input('checkbox');name.maxLength=48;name.setAttribute('aria-label',T('Nome deste canal'));hidden.setAttribute('aria-label',T('Ocultar este canal'));
    const visibility=make('label',undefined,'cooling-check');visibility.append(hidden,make('span',T('Ocultar este canal')));
    const saveIdentity=make('button',T('Salvar identificação'),'button subtle');saveIdentity.type='button';
    saveIdentity.addEventListener('click',async()=>{const preference={key:row.control.identityKey,name:name.value.trim(),hidden:hidden.checked},preferences=(data.channelPreferences||[]).filter(p=>p.key!==preference.key);preferences.push(preference);if(await change('/api/cooling',{channelPreferences:preferences}))row.presentationDirty=false;});
    for(const e of [name,hidden])e.addEventListener('input',()=>{row.presentationDirty=true;});
    identification.append(summary,field('Nome deste canal',name),visibility,make('p',T('Salvar identificação não altera as rotações. Canais selecionados continuam visíveis.'),'muted small'),saveIdentity);article.append(identification);Object.assign(row,{channelName:name,channelHidden:hidden,saveIdentity});
    rows.set(control.id,row);return article;
  }
  function assignments(){const group=sharedSettings();return [...rows.values()].filter(r=>r.enabled.checked).map(r=>{
    const sources=group&&!r.sensor.value?{sensorId:group.sensorId,...(group.sensorIds?{sensorIds:group.sensorIds}:{})}:readSources(r.sources);
    return {controlId:r.control.id,...sources,rpmId:r.rpm.value||null,minPercent:Number(r.minimum.value),critical:Number(r.critical.value),...curveSettings(r)};
  });}
  function filterChannels(){let shown=0;for(const row of rows.values()){row.article.hidden=!$('cooling-show-all').checked&&row.control.hidden&&!row.enabled.checked;if(!row.article.hidden)shown++;}$('cooling-channel-count').textContent=shown+' / '+rows.size+' '+T('canais exibidos');}
  function editPreset(profile,points,interpolation){
    if(!profile&&(data.customProfiles||[]).length>=3)return problem(T('Você pode salvar até três perfis personalizados.'));
    const selected=data.profiles.find(p=>p.id===data.profile),curve=createCurve(points||profile?.points||selected.points,true,interpolation||profile?.interpolation||selected.interpolation||'linear');curve.custom.closest('label').hidden=true;
    pendingPreset={id:profile?.id,curve};$('cooling-preset-curve').replaceChildren(curve.container);$('cooling-preset-name').value=profile?.name||'';$('cooling-preset-editor').hidden=false;$('cooling-preset-name').focus();
  }
  function drawLibrary(){
    const bank=data.customProfiles||[],next=JSON.stringify(bank);$('cooling-custom-count').textContent=bank.length+' / 3';
    if(next!==librarySignature){librarySignature=next;$('cooling-custom-list').replaceChildren(...bank.map(profile=>{
      const card=make('article',undefined,'panel'),name=make('strong',profile.name),edit=make('button',T('Editar'),'button subtle'),remove=make('button',T('Excluir'),'button subtle');edit.type=remove.type='button';remove.dataset.profile=profile.id;remove.dataset.delete='true';
      edit.addEventListener('click',()=>editPreset(profile));remove.addEventListener('click',()=>change('/api/cooling',{customProfiles:(data.customProfiles||[]).filter(p=>p.id!==profile.id)}));card.append(name,edit,remove);return card;
    }));}
  }
  function drawStatus(){
    if(shared)updateSources(shared.sources);
    const mode={off:'Desligado',starting:'Iniciando…',waiting:'Aguardando sensores para retomar…',monitoring:'Somente monitoramento',controlling:'Controle ativo',fault:'Verifique a ventilação'}[data?.mode||'off'];
    $('cooling-mode').textContent=(data?.simulated?T('Simulação')+' · ':'')+T(mode);
    if(data?.profilePending)$('cooling-mode').textContent+=' · '+T('Perfil alterado; selecione novamente para aplicar.');
    if(!busy)$('cooling-enabled').checked=Boolean(data?.enabled);$('cooling-enabled').disabled=!admin||busy||data?.resumePending||!data?.available||!data.controls.some(c=>c.controllable)&&!data?.enabled;
    $('cooling-monitor').disabled=!admin||busy||data?.resumePending||!data?.available||Boolean(data?.enabled);
    $('cooling-stop').disabled=!admin||busy||!data||data.mode==='off';
    $('cooling-save').disabled=!admin||busy||data?.resumePending||!data?.controls.length;$('cooling-linked').disabled=!admin||busy||data?.resumePending;$('cooling-select-visible').disabled=!admin||busy||data?.resumePending||!data?.controls.some(c=>c.controllable);
    $('cooling-resume').hidden=!data?.assignments.length;
    $('cooling-resume').textContent=T(data?.resumePending?'Configuração preservada. Aguardando os sensores para retomar a curva salva.':data?.resumeOnStartup?(data.enabled?'Configuração salva. A curva será retomada ao iniciar o PC.':'Configuração preservada. Não foi possível retomar; confira o aviso e a associação dos sensores.'):'Curvas e associações salvas. Ative o controle para habilitar a retomada ao iniciar o PC.');
    $('cooling-access').hidden=admin&&Boolean(data?.available);
    if(data?.error)problem(data.error);
    for(const button of $('cooling-profiles').children){button.disabled=!admin||busy||data?.resumePending;button.setAttribute('aria-pressed',String(button.dataset.profile===data?.profile));}
    $('cooling-custom-new').disabled=!admin||busy||(data?.customProfiles||[]).length>=3;$('cooling-preset-save').disabled=!admin||busy;
    for(const button of $('cooling-custom-list').querySelectorAll('button')){button.disabled=!admin||busy||button.dataset.delete==='true'&&button.dataset.profile===data?.profile;if(button.dataset.delete==='true')button.title=button.dataset.profile===data?.profile?T('Selecione outro perfil antes de excluir o atual.') : '';}
    for(const row of rows.values()){row.saveIdentity.disabled=!admin||busy;row.enabled.disabled=!admin||busy||!row.control.controllable;row.minimum.disabled=!row.control.controllable;}
  }
  function draw(){
    if(!data)return;
    const presetSignature=JSON.stringify(data.profiles);if(presetSignature!==profileSignature){profileSignature=presetSignature;$('cooling-profiles').replaceChildren();for(const preset of data.profiles){const button=make('button',preset.custom?preset.name:T(preset.name),'button subtle');button.type='button';button.dataset.profile=preset.id;button.addEventListener('click',()=>{
      try{change('/api/cooling',{profile:preset.id,group:sharedSettings(false),assignments:assignments().map(({points,interpolation,...value})=>value)});}catch(error){problem(error);}
    });$('cooling-profiles').append(button);}}drawLibrary();drawPreview();
    const next=JSON.stringify([data.controls.map(c=>[c.id,c.identityKey]),data.sensors.map(s=>s.id),data.fans.map(f=>f.id),data.profile,data.assignments,data.group,data.enabled?data.resumeProfile:null]);
    if(next!==signature){signature=next;rows=new Map();$('cooling-channels').replaceChildren(...data.controls.map(channel));createShared();}
    for(const [id,row] of rows){row.control=data.controls.find(c=>c.id===id)||row.control;const control=row.control;row.title.textContent=control.name;row.original.textContent=control.originalName||control.name;row.original.hidden=row.original.textContent===row.title.textContent;row.identity.textContent=T(control.identitySource==='user'?'Identificado por você':control.identitySource==='backend'?'Nome informado pelo sensor':'Conector não identificado')+(control.connectorHint?' · '+T('Sugestão não confirmada: {0}',control.connectorHint):'')+(!control.controllable?' · '+T('Somente leitura: sem faixa segura de controle'):T(' · Faixa de controle: {0}–{1}%',control.limits.minimum,control.limits.maximum));row.minimum.min=control.limits.minimum;row.minimum.max=control.limits.maximum;if(!row.presentationDirty){row.channelName.value=control.identitySource==='user'?control.name:'';row.channelHidden.checked=Boolean(control.hidden);}const output=data.outputs.find(o=>o.id===id),temperature=data.sensors.find(s=>s.id===row.sensor.value)?.value,rpm=data.fans.find(f=>f.id===row.rpm.value)?.value;
      const displayedTemperature=output?output.temperature:temperature;
      if(!row.sources.container.hidden)updateSources(row.sources);
      row.output.textContent=(output?`${output.percent}% ${T('solicitado')}`:T('Sem comando de rotação'))+(Number.isFinite(displayedTemperature)?` · ${Math.round(displayedTemperature)} °C`:'')+(Number.isFinite(rpm)?` · ${Math.round(rpm)} RPM`:' · '+T('RPM não associado'))+(output?.failsafe?' · '+T('Sensor inválido: saída de proteção'):'');}
    filterChannels();$('cooling-identification').hidden=!data.controls.length;$('cooling-empty').hidden=Boolean(data.controls.length);$('cooling-empty').textContent=T(data.mode==='off'?'Inicie a detecção para ver os canais compatíveis. Detectar sensores não altera a rotação.':'A biblioteca não informou canais de controle. A detecção não altera rotações nem garante suporte de escrita.');$('cooling-capabilities').hidden=data.mode==='off';$('cooling-capabilities').textContent=T('{0} sensores de temperatura · {1} leituras de RPM · {2} canais informados · {3} com faixa segura',data.sensors.length,data.fans.length,data.controls.length,data.controls.filter(c=>c.controllable).length);drawStatus();
  }
  $('cooling-show-all').addEventListener('change',filterChannels);
  $('cooling-preview-profile').addEventListener('change',drawPreview);
  $('cooling-select-visible').addEventListener('click',()=>{for(const row of rows.values())if(!row.article.hidden&&row.control.controllable)row.enabled.checked=true;filterChannels();});
  $('cooling-linked').addEventListener('change',()=>{if($('cooling-linked').checked&&!shared)createShared(true);else linkedMode();});
  $('cooling-custom-new').addEventListener('click',()=>editPreset(null));
  $('cooling-preset-cancel').addEventListener('click',()=>{pendingPreset=null;$('cooling-preset-editor').hidden=true;});
  $('cooling-preset-editor').addEventListener('submit',async event=>{event.preventDefault();if(!pendingPreset||busy)return;const {id,curve}=pendingPreset,profile={id:id||'custom-'+crypto.randomUUID().replaceAll('-',''),name:$('cooling-preset-name').value.trim(),interpolation:curve.interpolation.value,points:curve.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).sort((a,b)=>a[0]-b[0])};const bank=(data.customProfiles||[]).map(p=>p.id===profile.id?profile:p);if(!id)bank.push(profile);const result=await change('/api/cooling',{customProfiles:bank});if(result){pendingPreset=null;$('cooling-preset-editor').hidden=true;}});
  $('cooling-monitor').addEventListener('click',()=>change('/api/cooling/monitor',{}));
  $('cooling-stop').addEventListener('click',()=>change('/api/cooling',{enabled:false}));
  $('cooling-enabled').addEventListener('change',()=>{try{const enabled=$('cooling-enabled').checked;change('/api/cooling',{enabled,...(enabled?{assignments:assignments(),group:sharedSettings()}: {})});}catch(error){$('cooling-enabled').checked=false;problem(error);}});
  $('cooling-save').addEventListener('click',()=>{try{change('/api/cooling',{assignments:assignments(),group:sharedSettings()});}catch(error){problem(error);}});
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&current)refresh();});
  window.addEventListener('nexus:languagechange',()=>{signature='';profileSignature='';librarySignature='';previewSignature='';previewCurveSignature='';draw();});
  window.NexusCooling={update(state,isAdmin,request,toast,page){admin=isAdmin;api=request;if(page==='cooling'&&!current)this.open(true);},open(value){
    const was=current;current=value;clearTimeout(timer);if(value)refresh();
    else if(was&&data?.mode==='monitoring'&&!data?.resumePending)change('/api/cooling/monitor',{enabled:false});
  }};
})();
