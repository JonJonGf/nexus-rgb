(function(root){
  'use strict';
  // Shared, bounded math for phone preview and LED composition. Coordinates use
  // the same 320x200 plane as the spatial map, including circular fan geometry.
  function sample(x,y,events,time) {
    let red=0,green=0,blue=0,alpha=0;
    for(const e of events){
      const age=time-e.at;if(age<0||age>=e.durationMs)continue;
      const p=age/e.durationMs, dx=(x-e.x)*1.6, dy=y-e.y, radius=e.radius||.18;
      const distance=e.kind==='sweep'?Math.abs(dx-p*1.6):Math.hypot(dx,dy);
      const amount=Math.max(0,1-(e.kind==='ripple'?Math.abs(distance-p*.9):distance)/radius)*(1-p);
      if(amount<=0)continue;
      const rgb=e.rgb||[1,3,5].map(i=>parseInt(e.color.slice(i,i+2),16));
      red+=rgb[0]*amount;green+=rgb[1]*amount;blue+=rgb[2]*amount;alpha=Math.max(alpha,amount);
    }
    return {red:Math.min(255,Math.round(red)),green:Math.min(255,Math.round(green)),blue:Math.min(255,Math.round(blue)),alpha};
  }
  const api={sample};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NexusLive=api;
})(typeof globalThis!=='undefined'?globalThis:this);
