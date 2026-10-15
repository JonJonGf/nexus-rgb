'use strict';
const { StudioRenderer } = require('./studio-render');
const renderer = new StudioRenderer();
const { createCanvas } = require('@napi-rs/canvas');
const previewCanvas = createCanvas(320, 200), previewContext = previewCanvas.getContext('2d');
let loaded = false, start = performance.now();
process.on('message', async message => {
  try {
    if (message.kind === 'load') { await renderer.load(message.effect, message.values); loaded = true; start = performance.now(); process.send({ kind: 'ready' }); }
    else if (message.kind === 'frame' && loaded) {
      const pixels = renderer.frame(performance.now() - start);
      const colors = renderer.sample(message.points, pixels);
      if (process.memoryUsage().rss > 256 * 1024 * 1024) throw Error('O motor excedeu o limite observado de memória.');
      let preview = null;
      if (message.preview) { previewContext.clearRect(0, 0, 320, 200); previewContext.drawImage(renderer.canvas, 0, 0, 320, 200); preview = previewCanvas.toBuffer('image/png'); }
      process.send({ kind: 'frame', colors, preview, renderMs: renderer.lastRenderMs, memoryMB: process.memoryUsage().rss / 1048576 });
    }
  } catch (error) {
    process.send({ kind: 'failure', error: String(error.message || error).slice(0, 160) });
  }
});
process.on('disconnect', () => { renderer.close(); process.exit(0); });
