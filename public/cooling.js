'use strict';
(() => {
  const $=id=>document.getElementById(id),T=window.NexusI18n;
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let api,admin=false,current=false,data,busy=false,timer,signature='',rows=new Map();
  function problem(error){$('cooling-error').textContent=T(error.message||error);$('cooling-error').hidden=false;}
  async function change(route,body){
    if(busy)return;busy=true;drawStatus();$('cooling-error').hidden=true;
    try{data=await api(route,body);signature='';draw();return data;}catch(error){problem(error);}
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
    row.line.setAttribute('points',points.map(([x,y])=>`${10+(x-20)*3.5},${140-y*1.3}`).join(' '));
  }
  function addPoint(row,point){
    const temperature=input('number',point[0],20,100),percent=input('number',point[1],20,100),tr=make('tr');
    temperature.setAttribute('aria-label',T('Temperatura do ponto'));percent.setAttribute('aria-label',T('Velocidade do ponto'));
    const remove=make('button',T('Remover'),'button subtle');remove.type='button';
    const entry={temperature,percent};for(const e of [temperature,percent,remove]){const td=make('td');td.append(e);tr.append(td);}row.table.append(tr);row.points.push(entry);
    remove.addEventListener('click',()=>{if(row.points.length<=2)return;row.points=row.points.filter(p=>p!==entry);tr.remove();graph(row);});
    for(const e of [temperature,percent])e.addEventListener('input',()=>graph(row));
  }
  function channel(control){
    const saved=data.assignments.find(a=>a.controlId===control.id),article=make('article',undefined,'panel cooling-channel');
    const title=make('h3',control.name),enabled=input('checkbox');enabled.checked=Boolean(saved);enabled.setAttribute('aria-label',T('Controlar este canal'));
    const enable=make('label',undefined,'cooling-check');enable.append(enabled,make('span',T('Controlar este canal')));article.append(title,enable);
    const output=make('p','', 'cooling-output');article.append(output);
    const sensor=select('Sensor de temperatura',data.sensors,saved?.sensorId),rpm=select('Leitura de RPM',data.fans,saved?.rpmId);
    const minimum=input('number',saved?.minPercent??40,20,100),critical=input('number',saved?.critical??85,60,100);
    const fields=make('div',undefined,'cooling-fields');fields.append(field('Sensor de temperatura',sensor),field('Leitura de RPM',rpm),field('Mínimo (%)',minimum),field('Proteção térmica (°C)',critical));article.append(fields);
    const detail=make('details'),summary=make('summary',T('Editar curva')),custom=input('checkbox');custom.checked=Boolean(saved?.points);
    const customLabel=make('label',undefined,'cooling-check');customLabel.append(custom,make('span',T('Usar curva personalizada')));
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 150');svg.setAttribute('class','cooling-graph');svg.setAttribute('role','img');svg.setAttribute('aria-label',T('Curva de temperatura e velocidade'));
    const line=document.createElementNS(svg.namespaceURI,'polyline');svg.append(line);
    const table=make('table'),head=make('thead'),headers=make('tr'),body=make('tbody');for(const label of ['Temperatura (°C)','Velocidade (%)',''])headers.append(make('th',T(label)));head.append(headers);table.append(head,body);
    const row={control,enabled,sensor,rpm,minimum,critical,custom,table:body,line,output,points:[]};
    for(const point of saved?.points||data.profiles.find(p=>p.id===data.profile).points)addPoint(row,point);
    const add=make('button',T('Adicionar ponto'),'button subtle');add.type='button';add.addEventListener('click',()=>{if(row.points.length<8){addPoint(row,[70,80]);custom.checked=true;graph(row);}});
    detail.append(summary,customLabel,svg,table,add);article.append(detail);graph(row);rows.set(control.id,row);return article;
  }
  function assignments(){return [...rows.values()].filter(r=>r.enabled.checked).map(r=>{
    if(!r.sensor.value)throw Error('Escolha um sensor para cada canal selecionado.');
    return {controlId:r.control.id,sensorId:r.sensor.value,rpmId:r.rpm.value||null,minPercent:Number(r.minimum.value),critical:Number(r.critical.value),
      ...(r.custom.checked?{points:r.points.map(p=>[Number(p.temperature.value),Number(p.percent.value)]).sort((a,b)=>a[0]-b[0])}:{})};
  });}
  function drawStatus(){
    const mode={off:'Desligado',starting:'Iniciando…',monitoring:'Somente monitoramento',controlling:'Controle ativo',fault:'Verifique a ventilação'}[data?.mode||'off'];
    $('cooling-mode').textContent=(data?.simulated?T('Simulação')+' · ':'')+T(mode);
    if(!busy)$('cooling-enabled').checked=Boolean(data?.enabled);$('cooling-enabled').disabled=!admin||busy||!data?.available;
    $('cooling-monitor').disabled=!admin||busy||!data?.available||Boolean(data?.enabled);
    $('cooling-stop').disabled=!admin||busy||!data||data.mode==='off';
    $('cooling-save').disabled=!admin||busy||!data?.controls.length;
    $('cooling-access').hidden=admin&&Boolean(data?.available);
    if(data?.error)problem(data.error);
    for(const button of $('cooling-profiles').children){button.disabled=!admin||busy;button.setAttribute('aria-pressed',String(button.dataset.profile===data?.profile));}
  }
  function draw(){
    if(!data)return;
    if(!$('cooling-profiles').children.length)for(const preset of data.profiles){const button=make('button',T(preset.name),'button subtle');button.type='button';button.dataset.profile=preset.id;button.addEventListener('click',()=>{
      try{change('/api/cooling',{profile:preset.id,assignments:assignments().map(({points,...value})=>value)});}catch(error){problem(error);}
    });$('cooling-profiles').append(button);}
    const next=JSON.stringify([data.controls.map(c=>c.id),data.sensors.map(s=>s.id),data.fans.map(f=>f.id),data.profile,data.assignments]);
    if(next!==signature){signature=next;rows=new Map();$('cooling-channels').replaceChildren(...data.controls.map(channel));}
    for(const [id,row] of rows){const output=data.outputs.find(o=>o.id===id),temperature=data.sensors.find(s=>s.id===row.sensor.value)?.value,rpm=data.fans.find(f=>f.id===row.rpm.value)?.value;
      row.output.textContent=(output?`${output.percent}% ${T('solicitado')}`:T('Sem comando de rotação'))+(Number.isFinite(temperature)?` · ${Math.round(temperature)} °C`:'')+(Number.isFinite(rpm)?` · ${Math.round(rpm)} RPM`:'')+(output?.failsafe?' · '+T('Sensor inválido: saída de proteção'):'');}
    $('cooling-empty').hidden=Boolean(data.controls.length);drawStatus();
  }
  $('cooling-monitor').addEventListener('click',()=>change('/api/cooling/monitor',{}));
  $('cooling-stop').addEventListener('click',()=>change('/api/cooling',{enabled:false}));
  $('cooling-enabled').addEventListener('change',()=>{try{const enabled=$('cooling-enabled').checked;change('/api/cooling',{enabled,...(enabled?{assignments:assignments()}: {})});}catch(error){$('cooling-enabled').checked=false;problem(error);}});
  $('cooling-save').addEventListener('click',()=>{try{change('/api/cooling',{assignments:assignments()});}catch(error){problem(error);}});
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&current)refresh();});
  window.addEventListener('nexus:languagechange',()=>{signature='';$('cooling-profiles').replaceChildren();draw();});
  window.NexusCooling={update(state,isAdmin,request,toast,page){admin=isAdmin;api=request;if(page==='cooling'&&!current)this.open(true);},open(value){
    const was=current;current=value;clearTimeout(timer);if(value)refresh();
    else if(was&&data?.mode==='monitoring')change('/api/cooling',{enabled:false});
  }};
})();
