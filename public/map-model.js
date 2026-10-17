(function(root) {
  'use strict';
  const copy = value => structuredClone(value), signature = value => JSON.stringify(value);
  function describeChange(previous, next) {
    if (!previous || !next) return '';
    if (Array.isArray(previous) && Array.isArray(next)) {
      if (previous.length !== next.length) return 'divisão';
      for (let i = 0; i < next.length; i++) {
        const a = previous[i], b = next[i];
        if (!a || !b) continue;
        if (a.x !== b.x || a.y !== b.y) return 'posição';
        if (a.width !== b.width || a.height !== b.height) return 'tamanho';
        if (a.rotation !== b.rotation) return 'rotação';
        if (a.shape !== b.shape || a.columns !== b.columns) return 'formato';
        if (a.reverse !== b.reverse || a.start !== b.start || a.count !== b.count) return 'sequência de LEDs';
        if (signature(a.rings) !== signature(b.rings) || signature(a.ledOrder) !== signature(b.ledOrder) || a.wiring !== b.wiring) return 'calibração';
        if ((a.group || '') !== (b.group || '')) return 'grupo';
        if (a.name !== b.name) return 'nome';
      }
      return '';
    }
    if (typeof previous === 'object' && typeof next === 'object') {
      if (signature(previous.palette) !== signature(next.palette)) return 'cores';
      if (previous.pattern !== next.pattern) return 'movimento';
      if (previous.speed !== next.speed) return 'ritmo';
      if (previous.angle !== next.angle) return 'direção';
      if (previous.scale !== next.scale) return 'escala';
      if (previous.name !== next.name) return 'nome';
    }
    return '';
  }
  class History {
    constructor(limit = 60) { this.limit=limit; this.entries=[]; this.labels=[]; this.index=-1; }
    reset(value) { this.entries=[copy(value)]; this.labels=['']; this.index=0; }
    current() { return this.entries[this.index]; }
    record(value, label) {
      if (signature(value) === signature(this.current())) return false;
      const inferred = label || describeChange(this.current(), value);
      this.entries.splice(this.index+1); this.labels.splice(this.index+1);
      this.entries.push(copy(value)); this.labels.push(inferred);
      while (this.entries.length>this.limit || this.entries.length>1 && signature(this.entries).length>2*1024*1024) { this.entries.shift(); this.labels.shift(); }
      this.index=this.entries.length-1; return true;
    }
    get undoable() { return this.index>0; }
    get redoable() { return this.index<this.entries.length-1; }
    get undoLabel() { return this.undoable ? (this.labels[this.index] || '') : ''; }
    get redoLabel() { return this.redoable ? (this.labels[this.index+1] || '') : ''; }
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
