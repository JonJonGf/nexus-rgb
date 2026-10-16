'use strict';
window.NexusWorkspace = {
  create(hooks) {
    const T=window.NexusI18n, M=window.NexusMapModel, history=new M.History(), keys=new Set();
    const $=id=>document.getElementById(id), make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=T(text);if(cls)e.className=cls;return e;};
    let suspended=false, admin=false, mounted=false;
    const bar=make('div',undefined,'map-tools');
    const undo=make('button','Desfazer ↶','button subtle'),redo=make('button','Refazer ↷','button subtle'),snap=make('input'),label=make('label'),group=make('button','Selecionar grupo','button subtle');
    undo.id='map-undo';redo.id='map-redo';snap.type='checkbox';snap.id='map-snap';label.append(snap,make('span','Alinhar à grade'));bar.append(undo,redo,label,group);document.querySelector('.studio-toolbar').after(bar);
    const groupField=make('label','Grupo'),name=make('input');name.id='map-group';name.maxLength=40;groupField.append(name);$('studio-device-form').append(groupField);
    const note=make('p','Shift + clique seleciona várias peças.','muted small');bar.append(note);
    function update() {undo.disabled=!admin||!history.undoable;redo.disabled=!admin||!history.redoable;name.disabled=!admin;group.disabled=!hooks.get()?.layout.find(e=>e.key===hooks.selected())?.group;}
    function replay(value) {if(!value||!admin)return;suspended=true;try{hooks.get().layout=value;keys.clear();hooks.save();}finally{suspended=false;}update();}
    undo.addEventListener('click',()=>replay(history.undo()));redo.addEventListener('click',()=>replay(history.redo()));
    document.addEventListener('keydown',e=>{if(!admin||!document.querySelector('[data-view=studio].active')||e.target.closest('input,textarea,select,[contenteditable=true]')||!(e.ctrlKey||e.metaKey)||!['z','y'].includes(e.key.toLowerCase()))return;e.preventDefault();if(e.key.toLowerCase()==='y'||e.shiftKey)replay(history.redo());else replay(history.undo());});
    name.addEventListener('change',()=>{const entry=hooks.get()?.layout.find(e=>e.key===hooks.selected());if(!entry||!admin)return;for(const part of hooks.get().layout.filter(e=>keys.has(e.key)))part.group=name.value;hooks.save();});
    group.addEventListener('click',()=>{const active=hooks.get()?.layout.find(e=>e.key===hooks.selected());if(!active?.group)return;keys.clear();hooks.get().layout.filter(e=>e.group===active.group).forEach(e=>keys.add(e.key));paint();});
    function paint() {document.querySelectorAll('.studio-item,#studio-device-chips button').forEach(e=>{const active=keys.has(e.dataset.key);e.classList.toggle('selected',active);if(e.closest('#studio-device-chips'))e.setAttribute('aria-pressed',String(active));});}
    function sync(layout) {
      if(!mounted) {history.reset(layout);mounted=true;}
      else if(!suspended&&M.signature(layout)!==M.signature(history.current()))history.reset(layout);
      const selected=hooks.selected();if(selected&&!keys.has(selected)){keys.clear();keys.add(selected);}
      for(const key of keys)if(!layout.some(e=>e.key===key))keys.delete(key);
      const entry=layout.find(e=>e.key===selected);if(document.activeElement!==name)name.value=entry?.group||'';paint();update();
    }
    function record() {if(mounted&&!suspended)history.record(hooks.get().layout);update();}
    function select(key,toggle=false) {if(toggle){if(keys.has(key)&&keys.size>1)keys.delete(key);else keys.add(key);}else if(!keys.has(key)){keys.clear();keys.add(key);}paint();}
    function origin(key) {select(key);return hooks.get().layout.filter(e=>keys.has(e.key)).map(e=>({...e}));}
    function move(entries,dx,dy) {for(const moved of M.move(entries,dx,dy,snap.checked)){const entry=hooks.get().layout.find(e=>e.key===moved.key);if(entry){entry.x=moved.x;entry.y=moved.y;hooks.position(document.querySelector('.studio-item[data-key="'+CSS.escape(entry.key)+'"]'),entry);}}}
    function decorate(button,entry) {
      if(!admin||entry.key!==hooks.selected())return;
      for(const kind of ['size','rotate']) {
        const handle=make('span',undefined,'map-handle map-handle-'+kind);handle.setAttribute('aria-hidden','true');button.append(handle);
        handle.addEventListener('pointerdown',e=>{
          e.preventDefault();e.stopPropagation();const rect=$('studio-stage').getBoundingClientRect(),base={...entry},start={x:e.clientX,y:e.clientY};handle.setPointerCapture(e.pointerId);hooks.gesture(true);
          const change=event=>{
            if(kind==='rotate')entry.rotation=Math.round((Math.atan2(event.clientY-rect.top-base.y*rect.height,event.clientX-rect.left-base.x*rect.width)*180/Math.PI+90)/(event.shiftKey?15:1))*(event.shiftKey?15:1);
            else {const a=-base.rotation*Math.PI/180,dx=event.clientX-start.x,dy=event.clientY-start.y;entry.width=Math.max(.01,Math.min(1,base.width+2*(dx*Math.cos(a)-dy*Math.sin(a))/rect.width));entry.height=Math.max(.01,Math.min(1,base.height+2*(dx*Math.sin(a)+dy*Math.cos(a))/rect.height));}
            hooks.position(button,entry);hooks.mark();hooks.selection(true);
          };
          const finish=()=>{hooks.gesture(false);handle.removeEventListener('pointermove',change);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);record();hooks.mark();};
          handle.addEventListener('pointermove',change);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
        });
      }
    }
    window.addEventListener('nexus:languagechange',()=>{undo.textContent=T('Desfazer ↶');redo.textContent=T('Refazer ↷');label.querySelector('span').textContent=T('Alinhar à grade');group.textContent=T('Selecionar grupo');note.textContent=T('Shift + clique seleciona várias peças.');groupField.firstChild.textContent=T('Grupo');});
    return {sync,record,select,origin,move,decorate,paint,update(value){admin=value;bar.hidden=!value;groupField.hidden=!value;update();},keys};
  }
};
