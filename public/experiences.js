'use strict';
(() => {
  const $=id=>document.getElementById(id),T=window.NexusI18n;
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let api,toast,admin=false,current=false,tab='live',data,room,state,loading=false,poll,stream,roomId=null;
  let rules=[],signalsDirty=false,steps=[{durationMs:5000,lighting:{color:'#00f0ff',effect:'wave'}}],sceneId=null;
  let recording=false,recorded=[],recordStart=0,recordTimer,events=[],queue=[],sendTimer,sending=false,raf=null,frame=null,pressed=null,lastTouch=0;
  const canvas=$('live-canvas'),ctx=canvas.getContext('2d');
  const motions={static:'Estático',rainbow:'Arco-íris',wave:'Onda',breathe:'Respiração',pulse:'Pulso',comet:'Cometa',scanner:'Vai e vem',sparkle:'Cintilação'};
  function error(e){$('experience-error').textContent=T(e.message||e);$('experience-error').hidden=false;}
  async function action(route,body,method='POST'){try{$('experience-error').hidden=true;const result=await api(route,body,method);if(result.warning)toast(T(result.warning));return result;}catch(e){error(e);return null;}}
  function button(text,run){const b=make('button',T(text),'button subtle');b.type='button';b.addEventListener('click',run);return b;}
  function select(options,value){const e=make('select');for(const [v,label]of options){const o=make('option',label);o.value=v;e.append(o);}e.value=value;return e;}
  function label(text,input){const e=make('label');e.append(make('span',T(text)),input);return e;}
  function input(type,value,cls){const e=make('input',undefined,cls);e.type=type;e.value=value;return e;}
  function drawSteps(){
    $('scene-steps').replaceChildren();
    steps.forEach((s,index)=>{
      const row=make('div',undefined,'scene-step');row.append(make('strong',String(index+1).padStart(2,'0')));
      const choice=select([...Object.entries(motions).map(([id,n])=>['effect:'+id,T(n)]),...(state?.profiles||[]).map(p=>['profile:'+p.id,p.name]),...(data?.recordings||[]).map(r=>['gesture:'+r.id,T('Gesto')+' · '+r.name])],s.recordingId?'gesture:'+s.recordingId:s.profileId?'profile:'+s.profileId:'effect:'+(s.lighting?.effect||'wave'));
      choice.className='scene-choice';choice.addEventListener('change',()=>{delete s.recordingId;if(choice.value.startsWith('profile:')){delete s.lighting;s.profileId=choice.value.slice(8);}else if(choice.value.startsWith('gesture:')){delete s.profileId;s.lighting={};s.recordingId=choice.value.slice(8);const recording=data.recordings.find(r=>r.id===s.recordingId);s.durationMs=Math.max(...recording.events.map(e=>e.atMs+e.durationMs));}else{delete s.profileId;s.lighting={effect:choice.value.slice(7),color:s.lighting?.color||'#00f0ff'};}drawSteps();});
      const color=input('color',s.lighting?.color||'#00f0ff');color.disabled=Boolean(s.profileId)||!admin;color.addEventListener('input',()=>{if(s.lighting)s.lighting.color=color.value;});
      const duration=input('number',s.durationMs/1000,'scene-duration');duration.min='.1';duration.max='3600';duration.step='.1';duration.addEventListener('input',()=>s.durationMs=Math.round(Number(duration.value)*1000));
      const transition=input('number',s.transitionMs||0);transition.min='0';transition.max='3000';transition.step='100';transition.addEventListener('input',()=>s.transitionMs=Number(transition.value));
      row.append(label('Efeito / perfil',choice),label('Cor',color),label('Segundos',duration),label('Fade (ms)',transition),button('×',()=>{steps.splice(index,1);drawSteps();}));
      for(const e of row.querySelectorAll('input,select,button'))if(!admin)e.disabled=true;
      $('scene-steps').append(row);
    });
  }
  function drawRules(){
    $('context-rules').replaceChildren();rules.forEach((rule,index)=>{const row=make('div',undefined,'experience-item'),name=make('strong',rule.application);name.append(make('small',state?.profiles.find(p=>p.id===rule.profileId)?.name||T('Perfil ausente')));row.append(name,button('Remover',()=>{rules.splice(index,1);signalsDirty=true;drawRules();}));$('context-rules').append(row);});
  }
  function draw(){
    if(!data)return;
    $('experience-status').textContent=data.active?`${data.active.name} · ${data.active.step}`:data.contextActive?T('Perfil por aplicativo ativo'):T('Sem cena temporária');
    $('audio-status').textContent=T({active:'Captura ativa · somente bandas de áudio',error:'Captura indisponível. Desative e ative para tentar novamente.',stopped:'Captura desativada',unavailable:'Aguardando a bandeja do Nexus'}[data.capture]||'Aguardando a bandeja do Nexus');
    if(!signalsDirty){const a=data.audio;$('audio-enabled').checked=a.enabled;$('audio-gain').value=a.gain;$('audio-axis').value=a.axis;['low','mid','high'].forEach((k,i)=>$('audio-'+k).value=a.palette[i]);$('context-enabled').checked=data.context.enabled;rules=structuredClone(data.context.rules||[]);drawRules();}
    const selected=$('context-profile').value;$('context-profile').replaceChildren(...(state?.profiles||[]).map(p=>{const o=make('option',p.name);o.value=p.id;return o;}));if([...$('context-profile').options].some(o=>o.value===selected))$('context-profile').value=selected;
    $('scene-list').replaceChildren();for(const s of data.scenes){const row=make('div',undefined,'experience-item'),title=make('strong',s.name);title.append(make('small',`${s.steps.length} × ${s.repeat} · ${(s.steps.reduce((n,e)=>n+e.durationMs,0)*s.repeat/1000).toFixed(1)} s`));const play=button('Iniciar',async()=>{const next=await action('/api/experiences/play',{id:s.id});if(next){await refresh();}});play.dataset.play=s.id;row.append(title,play);if(admin){row.append(button('Editar',()=>{sceneId=s.id;steps=structuredClone(s.steps);$('scene-name').value=s.name;$('scene-repeat').value=s.repeat;$('scene-alexa').checked=s.alexa;drawSteps();$('scene-name').focus();}),button('Excluir',async()=>{if(await action('/api/experiences/scenes/'+s.id,undefined,'DELETE'))await refresh();}));}$('scene-list').append(row);}
    $('recording-list').replaceChildren();for(const r of data.recordings){const row=make('div',undefined,'experience-item');row.append(make('strong',r.name),button('Reproduzir',()=>action('/api/experiences/recordings/'+r.id+'/play',{})));if(admin)row.append(button('Excluir',async()=>{if(await action('/api/experiences/recordings/'+r.id,undefined,'DELETE'))await refresh();}));$('recording-list').append(row);}
    $('room-list').replaceChildren();for(const d of room?.devices||[]){const row=make('div',undefined,'experience-item'),title=make('strong',d.name);title.append(make('small',`${d.ledCount} LEDs · ${d.address} · ${T(d.status)}`));row.append(title,button('Editar',()=>{roomId=d.id;for(const [id,v]of Object.entries({'room-name':d.name,'room-address':d.address,'room-port':d.port,'room-mode':d.mode,'room-effect':d.effectId,'room-preset':d.preset}))$(id).value=v;$('room-enabled').checked=d.enabled;$('room-native').hidden=d.mode!=='native';$('room-name').focus();}),button('Remover',async()=>{if(await action('/api/room/'+d.id,undefined,'DELETE'))await refresh();}));$('room-list').append(row);}
    $('experience-admin-note').hidden=admin;
    for(const id of ['scene-form','room-form','audio-form','context-form'])for(const e of $(id).querySelectorAll('input,button,select'))e.disabled=!admin;
    $('live-record').disabled=false;
    if(data.error)error(data.error);else if(room?.error)error(room.error);
  }
  async function refresh(){if(!api||loading)return;loading=true;try{data=await api('/api/experiences');if(admin)room=await api('/api/room');draw();}catch(e){error(e);}finally{loading=false;}}
  function choose(name){tab=name;document.querySelectorAll('[data-experience-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.experienceTab===name));});document.querySelectorAll('[data-experience-panel]').forEach(p=>p.hidden=p.dataset.experiencePanel!==name);if(name==='scenes')drawSteps();syncStream();}
  document.querySelectorAll('[data-experience-tab]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.experienceTab)));
  $('scene-add').addEventListener('click',()=>{if(steps.length<64){steps.push({durationMs:5000,lighting:{color:'#00f0ff',effect:'wave'}});drawSteps();}});
  $('scene-focus').addEventListener('click',()=>{sceneId=null;steps=[{durationMs:25*60000,transitionMs:800,lighting:{color:'#ffb86b',effect:'static'}},{durationMs:5*60000,transitionMs:800,lighting:{color:'#00ff99',effect:'breathe'}}];$('scene-name').value=T('Foco e pausa');drawSteps();});
  $('scene-form').addEventListener('submit',async e=>{e.preventDefault();if(await action('/api/experiences/scenes',{...(sceneId?{id:sceneId}:{}),name:$('scene-name').value,steps,repeat:Number($('scene-repeat').value),alexa:$('scene-alexa').checked})){sceneId=null;$('scene-name').value='';await refresh();}});
  $('experience-stop').addEventListener('click',async()=>{if(await action('/api/experiences/stop',{})){events=[];recording=false;clearTimeout(recordTimer);drawRecordButton();await refresh();requestDraw();}});
  $('room-mode').addEventListener('change',()=>$('room-native').hidden=$('room-mode').value!=='native');
  $('room-form').addEventListener('submit',async e=>{e.preventDefault();if(await action('/api/room',{...(roomId?{id:roomId}:{}),name:$('room-name').value,address:$('room-address').value.trim(),port:Number($('room-port').value),mode:$('room-mode').value,enabled:$('room-enabled').checked,effectId:Number($('room-effect').value),preset:Number($('room-preset').value)})){roomId=null;$('room-form').reset();$('room-native').hidden=true;await refresh();}});
  for(const id of ['audio-form','context-form'])$(id).addEventListener('input',()=>signalsDirty=true);
  $('audio-form').addEventListener('submit',async e=>{e.preventDefault();if(await action('/api/experiences/settings',{audio:{enabled:$('audio-enabled').checked,gain:Number($('audio-gain').value),axis:$('audio-axis').value,palette:['low','mid','high'].map(k=>$('audio-'+k).value)}})){signalsDirty=false;await refresh();}});
  $('context-add').addEventListener('click',()=>{const application=$('context-app').value.trim().toLowerCase(),profileId=$('context-profile').value;if(!application||!profileId)return;rules=rules.filter(r=>r.application!==application);rules.push({application,profileId});signalsDirty=true;$('context-app').value='';drawRules();});
  $('context-form').addEventListener('submit',async e=>{e.preventDefault();if(await action('/api/experiences/settings',{context:{enabled:$('context-enabled').checked,rules}})){signalsDirty=false;await refresh();}});
  function drawRecordButton(){$('live-record').textContent=T(recording?'Encerrar gravação':'Gravar gestos');}
  $('live-record').addEventListener('click',()=>{recording=!recording;clearTimeout(recordTimer);if(recording){recorded=[];recordStart=performance.now();recordTimer=setTimeout(()=>{recording=false;drawRecordButton();},30000);}drawRecordButton();});
  $('recording-form').addEventListener('submit',async e=>{e.preventDefault();recording=false;clearTimeout(recordTimer);drawRecordButton();if(await action('/api/experiences/recordings',{name:$('recording-name').value,events:recorded})){recorded=[];$('recording-name').value='';await refresh();}});
  function touch(e){
    const now=performance.now();if(now-lastTouch<60&&e.type==='pointermove')return;lastTouch=now;
    const rect=canvas.getBoundingClientRect(),event={x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height)),color:$('live-color').value,kind:$('live-kind').value,durationMs:1200};
    events.push({...event,at:now,rgb:[1,3,5].map(i=>parseInt(event.color.slice(i,i+2),16))});events=events.slice(-32);queue.push(event);queue=queue.slice(-16);
    if(recording&&recorded.length<256&&now-recordStart<=30000)recorded.push({...event,atMs:Math.round(now-recordStart)});
    if(recorded.length===256&&recording){recording=false;clearTimeout(recordTimer);drawRecordButton();}
    if(!sendTimer)sendTimer=setTimeout(flush,100);requestDraw();
  }
  async function flush(){clearTimeout(sendTimer);sendTimer=null;if(sending||!current||document.hidden||!queue.length)return;sending=true;const batch=queue;queue=[];await action('/api/experiences/live',{events:batch});sending=false;if(queue.length)sendTimer=setTimeout(flush,100);}
  canvas.addEventListener('pointerdown',e=>{if(!api||e.button!==0||pressed!==null)return;e.preventDefault();pressed=e.pointerId;canvas.setPointerCapture(e.pointerId);touch(e);});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pressed){e.preventDefault();touch(e);}});
  for(const kind of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(kind,e=>{if(e.pointerId===pressed){pressed=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}});
  canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const r=canvas.getBoundingClientRect();touch({type:'keydown',clientX:r.left+r.width/2,clientY:r.top+r.height/2});}});
  function requestDraw(){if(!raf&&current&&tab==='live'&&!document.hidden)raf=requestAnimationFrame(paint);}
  function paint(){
    raf=null;const now=performance.now();events=events.filter(e=>now-e.at<e.durationMs);ctx.fillStyle='#070d12';ctx.fillRect(0,0,640,400);
    if(events.length){for(let y=0;y<20;y++)for(let x=0;x<32;x++){const v=window.NexusLive.sample((x+.5)/32,(y+.5)/20,events,now);ctx.fillStyle=`rgba(${v.red},${v.green},${v.blue},.35)`;ctx.fillRect(x*20,y*20,20,20);}}
    ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;for(let x=0;x<640;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,400);ctx.stroke();}for(let y=0;y<400;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(640,y);ctx.stroke();}
    const outputs=new Map((frame?.output||[]).map(d=>[d.id,d.rgb?Uint8Array.from(atob(d.rgb),c=>c.charCodeAt(0)):null]));
    const stride=Math.max(1,Math.ceil((frame?.layout||[]).reduce((n,p)=>n+p.count,0)/4096));
    for(const piece of frame?.layout||[]){const rgb=outputs.get(piece.deviceId);for(const p of window.NexusSpatial.points(piece)){if(p.index%stride)continue;const i=p.index*3;ctx.fillStyle=rgb&&i+2<rgb.length?`rgb(${rgb[i]},${rgb[i+1]},${rgb[i+2]})`:'#4c5961';ctx.beginPath();ctx.arc(p.x*2,p.y*2,3,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#a9b7c0';ctx.font='10px monospace';ctx.fillText(piece.name||'',piece.x*640-piece.width*320,piece.y*400-piece.height*200-5,160);}
    if(events.length)requestDraw();
  }
  function syncStream(){
    stream?.close();stream=null;frame=null;if(raf)cancelAnimationFrame(raf);raf=null;
    if(!current||tab!=='live'||document.hidden)return;
    stream=new EventSource('/api/studio/preview');stream.onmessage=e=>{try{frame=JSON.parse(e.data);requestDraw();}catch{}};requestDraw();
  }
  document.addEventListener('visibilitychange',()=>{clearInterval(poll);poll=null;syncStream();if(!document.hidden&&current){refresh();poll=setInterval(refresh,5000);}else{queue=[];pressed=null;}});
  window.addEventListener('nexus:languagechange',()=>{draw();drawSteps();drawRecordButton();});
  window.NexusExperiences={update(next,isAdmin,request,showToast,page){state=next;admin=isAdmin;api=request;toast=showToast;if(!data)drawSteps();if(page==='experiences'&&!current)this.open(true);},open(value){current=value;clearInterval(poll);poll=null;if(value){refresh();drawSteps();if(!document.hidden)poll=setInterval(refresh,5000);}else{queue=[];pressed=null;clearTimeout(sendTimer);sendTimer=null;}syncStream();}};
})();
