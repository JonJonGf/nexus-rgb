(function(root) {
  'use strict';
  function leds(item) {
    const result = [], rings = item.shape === 'fan' ? item.rings || [{count:item.count,offset:0,reverse:false}] : [];
    let ringIndex = 0, ringStart = 0;
    for (let n = 0; n < item.count; n++) {
      const i = item.reverse ? item.count - 1 - n : n, t = item.count > 1 ? i / (item.count - 1) : 0.5;
      let x = 0, y = 0, circle;
      if (item.shape === 'fan') {
        while (ringIndex < rings.length - 1 && n >= ringStart + rings[ringIndex].count) { ringStart += rings[ringIndex].count; ringIndex++; }
        const ring = rings[ringIndex], local = n - ringStart, reversed = Boolean(item.reverse) !== Boolean(ring.reverse);
        const slot = ((reversed ? ring.count - 1 - local : local) + (ring.offset || 0)) % ring.count;
        const a = slot / ring.count * Math.PI * 2 - Math.PI / 2, radius = .44 * (1 - ringIndex / rings.length * .8);
        x = Math.cos(a) * item.width * radius; y = Math.sin(a) * item.height * radius;
        circle = {angle:a,radius,size:ring.count,rings:rings.length};
      }
      else if (item.shape === 'matrix') { const cols = item.columns, rows = Math.ceil(item.count / cols); x = ((i % cols + 0.5) / cols - 0.5) * item.width; y = ((Math.floor(i / cols) + 0.5) / rows - 0.5) * item.height; }
      else if (item.height > item.width) y = (t - 0.5) * item.height * 0.9;
      else x = (t - 0.5) * item.width * 0.9;
      result.push({index:item.start + (item.ledOrder?.[n] ?? n),x:x * 320,y:y * 200,circle});
    }
    return result;
  }
  function points(item) {
    const angle = item.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    // Rotation is in the 320x200 effect space, rather than a distorted unit square.
    return leds(item).map(p => ({deviceId:item.deviceId,index:p.index,x:item.x * 320 + p.x * cos - p.y * sin,y:item.y * 200 + p.x * sin + p.y * cos}));
  }
  function defaults(devices) {
    const columns = devices.length <= 6 ? Math.max(1, devices.length) : Math.min(16, Math.ceil(Math.sqrt(devices.length * 1.6))), rows = Math.max(1, Math.ceil(devices.length / columns));
    return devices.map((d, i) => ({ key: d.id, deviceId: d.id, name: d.name, start: 0, count: d.ledCount, x: (i % columns + 0.5) / columns, y: (Math.floor(i / columns) + 0.5) / rows, width: Math.min(d.type === 1 ? 0.045 : 0.13, 0.75 / columns), height: Math.min(d.type === 1 ? 0.45 : 0.21, 0.75 / rows), rotation: 0, shape: d.kind === 'argb' ? 'fan' : 'strip', columns: 8, reverse: false }));
  }
  const api = { points, defaults, leds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NexusSpatial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
