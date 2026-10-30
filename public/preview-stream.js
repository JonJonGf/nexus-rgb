'use strict';
(() => {
  function create({enabled,refresh,onFrame}){
    let source=null,timer=null,generation=0,delay=2000;
    function stop(){generation++;clearTimeout(timer);timer=null;source?.close();source=null;}
    function connect(epoch){
      if(epoch!==generation||!enabled())return;
      const current=new EventSource('/api/studio/preview');source=current;
      current.onmessage=event=>{
        if(epoch!==generation||source!==current)return;
        try{const frame=JSON.parse(event.data);delay=2000;onFrame(frame);}catch{}
      };
      current.onerror=()=>{
        if(epoch!==generation||source!==current)return;
        source=null;current.close();
        if(!enabled())return;
        const wait=delay;delay=Math.min(delay*2,15000);
        timer=setTimeout(async()=>{
          timer=null;if(epoch!==generation||!enabled())return;
          try{await refresh();}catch{}finally{if(epoch===generation&&enabled())connect(epoch);}
        },wait);
      };
    }
    return {start(){stop();delay=2000;connect(generation);},stop};
  }
  window.NexusPreviewStream={create};
})();
