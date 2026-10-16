(function(root) {
  'use strict';
  const copy = value => structuredClone(value), signature = value => JSON.stringify(value);
  class History {
    constructor(limit = 60) { this.limit=limit; this.entries=[]; this.index=-1; }
    reset(value) { this.entries=[copy(value)]; this.index=0; }
    current() { return this.entries[this.index]; }
    record(value) {
      if (signature(value) === signature(this.current())) return false;
      this.entries.splice(this.index+1); this.entries.push(copy(value));
      while (this.entries.length>this.limit || this.entries.length>1 && signature(this.entries).length>2*1024*1024) this.entries.shift();
      this.index=this.entries.length-1; return true;
    }
    get undoable() { return this.index>0; }
    get redoable() { return this.index<this.entries.length-1; }
    undo() { return this.undoable ? copy(this.entries[--this.index]) : null; }
    redo() { return this.redoable ? copy(this.entries[++this.index]) : null; }
  }
  function move(entries,dx,dy,snap = false) {
    if(!entries.length)return [];
    if(snap) {dx=Math.round((entries[0].x+dx)/.025)*.025-entries[0].x;dy=Math.round((entries[0].y+dy)/.025)*.025-entries[0].y;}
    dx=Math.max(-Math.min(...entries.map(e=>e.x)),Math.min(1-Math.max(...entries.map(e=>e.x)),dx));
    dy=Math.max(-Math.min(...entries.map(e=>e.y)),Math.min(1-Math.max(...entries.map(e=>e.y)),dy));
    return entries.map(e=>({...e,x:e.x+dx,y:e.y+dy}));
  }
  function clearCalibration(entry) { delete entry.rings; delete entry.ledOrder; }
  function calibration(count, rings, order) {
    if (!Number.isInteger(count) || count < 1 || count > 4096 || !Array.isArray(rings) || !rings.length || rings.length > 8 || rings.some(r=>!Number.isInteger(r.count)||r.count<1||!Number.isInteger(r.offset)||r.offset<0||r.offset>=r.count||typeof r.reverse!=='boolean') || rings.reduce((n,r)=>n+r.count,0)!==count) throw Error('Anéis: a soma deve corresponder à quantidade de LEDs da peça.');
    const result={rings:copy(rings)};
    if (order.trim()) {const values=order.trim().split(/[\s,;]+/).map(Number);if(values.length!==count||new Set(values).size!==count||values.some(n=>!Number.isInteger(n)||n<1||n>count))throw Error('Ordem física: informe cada LED da peça uma única vez.');result.ledOrder=values.map(n=>n-1);}
    return result;
  }
  const api={History,move,clearCalibration,signature,calibration};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NexusMapModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
