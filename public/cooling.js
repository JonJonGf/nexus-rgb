'use strict';
(() => {
  const $=id=>document.getElementById(id),T=window.NexusI18n;
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let api,admin=false,current=false,data,busy=false,timer,signature='',rows=new Map(),seenUseful=new Set(),profileSignature='',librarySignature='',pendingPreset=null;
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
  function graph(row){
    const points=row.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).filter(p=>p.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]);
    const plotted=[];for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],steps=row.interpolation.value==='smooth'?20:1;for(let j=0;j<steps;j++){const t=j/steps,r=row.interpolation.value==='smooth'?t*t*(3-2*t):t;plotted.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*r]);}}if(points.length)plotted.push(points.at(-1));
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
  function createCurve(points,manual,mode='linear'){
    const container=make('div'),detail=make('div',undefined,'cooling-curve-editor'),custom=make('select');custom.setAttribute('aria-label',T('Modo de controle'));custom.append(new Option(T('Seguir perfil selecionado'),'profile'),new Option(T('Curva manual'),'manual'));custom.value=manual?'manual':'profile';detail.hidden=custom.value!=='manual';container.append(field('Modo de controle',custom));
    custom.addEventListener('change',()=>{detail.hidden=custom.value!=='manual';});
    const interpolation=make('select');interpolation.setAttribute('aria-label',T('Traçado da curva'));interpolation.append(new Option(T('Linear'),'linear'),new Option(T('Suave'),'smooth'));interpolation.value=mode;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 150');svg.setAttribute('class','cooling-graph');svg.setAttribute('role','img');svg.setAttribute('aria-label',T('Curva de temperatura e velocidade'));
    for(const y of [10,42.5,75,107.5,140]){const grid=document.createElementNS(svg.namespaceURI,'line');grid.setAttribute('x1','10');grid.setAttribute('x2','290');grid.setAttribute('y1',y);grid.setAttribute('y2',y);svg.append(grid);}for(const [x,y,label]of [[10,8,'100%'],[10,149,'0%'],[42,149,'20 °C'],[257,149,'100 °C']]){const text=document.createElementNS(svg.namespaceURI,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.textContent=label;svg.append(text);}
    const line=document.createElementNS(svg.namespaceURI,'polyline'),handles=document.createElementNS(svg.namespaceURI,'g');svg.append(line,handles);
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
    const title=make('h3',T(control.name)),enabled=input('checkbox');enabled.checked=Boolean(saved);enabled.setAttribute('aria-label',T('Controlar este canal'));article.dataset.control=control.id;
    const enable=make('label',undefined,'cooling-check');enable.append(enabled,make('span',T('Controlar este canal')));article.append(title,enable);
    if(control.originalName&&control.originalName!==control.name)article.append(make('p',control.originalName,'muted small'));
    enabled.addEventListener('change',filterChannels);
    const output=make('p','', 'cooling-output');article.append(output);
    const sensor=select('Sensor de temperatura',data.sensors,saved?.sensorId),rpm=select('Leitura de RPM',data.fans,saved?.rpmId);
    const minimum=input('number',saved?.minPercent??40,20,100),critical=input('number',saved?.critical??85,60,100);
    const fields=make('div',undefined,'cooling-fields');fields.append(field('Sensor de temperatura',sensor),field('Leitura de RPM',rpm),field('Mínimo (%)',minimum),field('Proteção térmica (°C)',critical));article.append(fields);
    const selected=data.profiles.find(p=>p.id===data.profile),row=Object.assign(createCurve(saved?.points||selected.points,Boolean(saved?.points),saved?.points?saved.interpolation||'linear':selected.interpolation||'linear'),{control,article,enabled,sensor,rpm,minimum,critical,output});article.append(row.container);
    const save=make('button',T('Salvar como perfil personalizado'),'button subtle');save.type='button';save.addEventListener('click',()=>editPreset(null,row.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]),row.interpolation.value));article.append(save);
    rows.set(control.id,row);return article;
  }
  function assignments(){return [...rows.values()].filter(r=>r.enabled.checked).map(r=>{
    if(!r.sensor.value)throw Error('Escolha um sensor para cada canal selecionado.');
    return {controlId:r.control.id,sensorId:r.sensor.value,rpmId:r.rpm.value||null,minPercent:Number(r.minimum.value),critical:Number(r.critical.value),
      ...(r.custom.value==='manual'?{points:r.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).sort((a,b)=>a[0]-b[0]),interpolation:r.interpolation.value}:{})};
  });}
  function filterChannels(){let shown=0;for(const [id,row] of rows){if(row.control.useful)seenUseful.add(id);row.article.hidden=!$('cooling-show-all').checked&&!seenUseful.has(id)&&!row.enabled.checked;if(!row.article.hidden)shown++;}$('cooling-channel-count').textContent=shown+' / '+rows.size+' '+T('canais exibidos');}
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
    const mode={off:'Desligado',starting:'Iniciando…',monitoring:'Somente monitoramento',controlling:'Controle ativo',fault:'Verifique a ventilação'}[data?.mode||'off'];
    $('cooling-mode').textContent=(data?.simulated?T('Simulação')+' · ':'')+T(mode);
    if(data?.profilePending)$('cooling-mode').textContent+=' · '+T('Perfil alterado; selecione novamente para aplicar.');
    if(!busy)$('cooling-enabled').checked=Boolean(data?.enabled);$('cooling-enabled').disabled=!admin||busy||!data?.available;
    $('cooling-monitor').disabled=!admin||busy||!data?.available||Boolean(data?.enabled);
    $('cooling-stop').disabled=!admin||busy||!data||data.mode==='off';
    $('cooling-save').disabled=!admin||busy||!data?.controls.length;
    $('cooling-access').hidden=admin&&Boolean(data?.available);
    if(data?.error)problem(data.error);
    for(const button of $('cooling-profiles').children){button.disabled=!admin||busy;button.setAttribute('aria-pressed',String(button.dataset.profile===data?.profile));}
    $('cooling-custom-new').disabled=!admin||busy||(data?.customProfiles||[]).length>=3;$('cooling-preset-save').disabled=!admin||busy;
    for(const button of $('cooling-custom-list').querySelectorAll('button')){button.disabled=!admin||busy||button.dataset.delete==='true'&&button.dataset.profile===data?.profile;if(button.dataset.delete==='true')button.title=button.dataset.profile===data?.profile?T('Selecione outro perfil antes de excluir o atual.') : '';}
  }
  function draw(){
    if(!data)return;
    const presetSignature=JSON.stringify(data.profiles);if(presetSignature!==profileSignature){profileSignature=presetSignature;$('cooling-profiles').replaceChildren();for(const preset of data.profiles){const button=make('button',preset.custom?preset.name:T(preset.name),'button subtle');button.type='button';button.dataset.profile=preset.id;button.addEventListener('click',()=>{
      try{change('/api/cooling',{profile:preset.id,assignments:assignments().map(({points,interpolation,...value})=>value)});}catch(error){problem(error);}
    });$('cooling-profiles').append(button);}}drawLibrary();
    const next=JSON.stringify([data.controls.map(c=>[c.id,c.name]),data.sensors.map(s=>s.id),data.fans.map(f=>f.id),data.profile,data.assignments]);
    if(next!==signature){signature=next;rows=new Map();$('cooling-channels').replaceChildren(...data.controls.map(channel));}
    for(const [id,row] of rows){row.control=data.controls.find(c=>c.id===id)||row.control;const output=data.outputs.find(o=>o.id===id),temperature=data.sensors.find(s=>s.id===row.sensor.value)?.value,rpm=data.fans.find(f=>f.id===(row.rpm.value||row.control.suggestedRpmId))?.value;
      row.output.textContent=(output?`${output.percent}% ${T('solicitado')}`:T('Sem comando de rotação'))+(Number.isFinite(temperature)?` · ${Math.round(temperature)} °C`:'')+(Number.isFinite(rpm)?` · ${Math.round(rpm)} RPM`:'')+(output?.failsafe?' · '+T('Sensor inválido: saída de proteção'):'');}
    if(!data.controls.length)seenUseful.clear();filterChannels();$('cooling-identification').hidden=!data.controls.some(c=>c.identitySource==='board-suggestion');$('cooling-empty').hidden=Boolean(data.controls.length);drawStatus();
  }
  $('cooling-show-all').addEventListener('change',filterChannels);
  $('cooling-custom-new').addEventListener('click',()=>editPreset(null));
  $('cooling-preset-cancel').addEventListener('click',()=>{pendingPreset=null;$('cooling-preset-editor').hidden=true;});
  $('cooling-preset-editor').addEventListener('submit',async event=>{event.preventDefault();if(!pendingPreset||busy)return;const {id,curve}=pendingPreset,profile={id:id||'custom-'+crypto.randomUUID().replaceAll('-',''),name:$('cooling-preset-name').value.trim(),interpolation:curve.interpolation.value,points:curve.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).sort((a,b)=>a[0]-b[0])};const bank=(data.customProfiles||[]).map(p=>p.id===profile.id?profile:p);if(!id)bank.push(profile);const result=await change('/api/cooling',{customProfiles:bank});if(result){pendingPreset=null;$('cooling-preset-editor').hidden=true;}});
  $('cooling-monitor').addEventListener('click',()=>change('/api/cooling/monitor',{}));
  $('cooling-stop').addEventListener('click',()=>change('/api/cooling',{enabled:false}));
  $('cooling-enabled').addEventListener('change',()=>{try{const enabled=$('cooling-enabled').checked;change('/api/cooling',{enabled,...(enabled?{assignments:assignments()}: {})});}catch(error){$('cooling-enabled').checked=false;problem(error);}});
  $('cooling-save').addEventListener('click',()=>{try{change('/api/cooling',{assignments:assignments()});}catch(error){problem(error);}});
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&current)refresh();});
  window.addEventListener('nexus:languagechange',()=>{signature='';profileSignature='';librarySignature='';draw();});
  window.NexusCooling={update(state,isAdmin,request,toast,page){admin=isAdmin;api=request;if(page==='cooling'&&!current)this.open(true);},open(value){
    const was=current;current=value;clearTimeout(timer);if(value)refresh();
    else if(was&&data?.mode==='monitoring')change('/api/cooling',{enabled:false});
  }};
})();
