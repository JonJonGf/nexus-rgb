(function(root) {
  'use strict';
  function points(item) {
    const result = [], angle = item.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    for (let n = 0; n < item.count; n++) {
      const i = item.reverse ? item.count - 1 - n : n, t = item.count > 1 ? i / (item.count - 1) : 0.5;
      let x = 0, y = 0;
      if (item.shape === 'fan') { const a = i / item.count * Math.PI * 2 - Math.PI / 2; x = Math.cos(a) * item.width * 0.44; y = Math.sin(a) * item.height * 0.44; }
      else if (item.shape === 'matrix') { const cols = item.columns, rows = Math.ceil(item.count / cols); x = ((i % cols + 0.5) / cols - 0.5) * item.width; y = ((Math.floor(i / cols) + 0.5) / rows - 0.5) * item.height; }
      else if (item.height > item.width) y = (t - 0.5) * item.height * 0.9;
      else x = (t - 0.5) * item.width * 0.9;
      // Rotation is in the 320x200 effect space, rather than a distorted unit square.
      x *= 320; y *= 200;
      result.push({ deviceId: item.deviceId, index: item.start + n, x: item.x * 320 + x * cos - y * sin, y: item.y * 200 + x * sin + y * cos });
    }
    return result;
  }
  function defaults(devices) {
    const columns = devices.length <= 6 ? Math.max(1, devices.length) : Math.min(16, Math.ceil(Math.sqrt(devices.length * 1.6))), rows = Math.max(1, Math.ceil(devices.length / columns));
    return devices.map((d, i) => ({ key: d.id, deviceId: d.id, name: d.name, start: 0, count: d.ledCount, x: (i % columns + 0.5) / columns, y: (Math.floor(i / columns) + 0.5) / rows, width: Math.min(d.type === 1 ? 0.045 : 0.13, 0.75 / columns), height: Math.min(d.type === 1 ? 0.45 : 0.21, 0.75 / rows), rotation: 0, shape: d.kind === 'argb' ? 'fan' : 'strip', columns: 8, reverse: false }));
  }
  const api = { points, defaults };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NexusSpatial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
