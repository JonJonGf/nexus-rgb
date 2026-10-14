'use strict';
const { createApp } = require('../../server');
const { monitorEventLoopDelay } = require('node:perf_hooks');
let app;
process.on('disconnect', () => { if (app) app.stop().then(() => process.exit(0)); else process.exit(0); });
const delay = monitorEventLoopDelay({ resolution: 20 }); delay.enable();
process.on('message', message => {
  if (message === 'sample') process.send({ type: 'sample', memory: process.memoryUsage(), cpu: process.cpuUsage(), eventLoopP99Ms: delay.percentile(99) / 1e6 });
  if (message === 'stop') app.stop().then(() => process.exit(0));
});
createApp({ directory: process.env.NEXUS_TEST_DATA, localPort: 0, getInterfaces: () => [], disableHardware: true, disableAlexa: true })
  .then(async value => { app = value; const { localPort } = await app.start(); process.send({ type: 'ready', port: localPort }); })
  .catch(error => { console.error(error); process.exit(1); });
