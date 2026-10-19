'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./helpers/http-app');
const spatial = require('../public/spatial');

test('reading a saved Direct keyboard strip never changes its geometry or layout revision',async t=>{
  const {app,request,cookie}=await fixture(t),id='c'.repeat(24);
  app.hardware.devices.push({id,name:'Direct keyboard',type:5,ledCount:8,direct:{id:0},effects:['static','wave']});
  const strip={...spatial.defaults([{id,name:'Direct keyboard',type:5,ledCount:8}])[0],shape:'strip',width:.06,height:.5};
  const saved=await request('/api/studio',{method:'POST',cookie,body:{layout:[strip]}});assert.equal(saved.status,200);
  const revision=saved.json().layoutRevision;
  for(let i=0;i<3;i++){
    const result=(await request('/api/studio',{cookie})).json();assert.deepEqual(result.layout,[strip]);assert.equal(result.layoutRevision,revision);
  }
  assert.deepEqual(app.store.data.studio.layout,[strip]);
});

test('mapa omite teclado de modos internos, inclusive posições antigas, mas mantém seus controles', async t => {
  const { app, request, cookie } = await fixture(t);
  const keyboard = app.hardware.controllerRegistry.addKeyboardController({ name: 'RK61', layout: '60%' });
  app.hardware.devices.push(keyboard);
  const directKeyboard = { id: 'a'.repeat(24), name: 'Direct keyboard', type: 5, kind: 'keyboard', ledCount: 61, direct: { id: 0 }, effects: ['static', 'wave'] };
  app.hardware.devices.push(directKeyboard);
  app.store.data.studio = { ...app.studio.config, layout: spatial.defaults([{ id: keyboard.id, name: 'RK61', type: 5, ledCount: 61 }]) };
  const saved = structuredClone(app.store.data.studio.layout);
  const state = (await request('/api/state', { cookie })).json();
  assert.equal(state.hardware.devices.find(d => d.id === keyboard.id).spatialCapable, false);
  const studio = (await request('/api/studio', { cookie })).json();
  assert.equal(studio.layout.some(i => i.deviceId === keyboard.id), false);
  assert.equal(studio.layout.some(i => i.deviceId === directKeyboard.id), true, 'teclados por LED continuam no mapa');
  assert.deepEqual(app.store.data.studio.layout, saved, 'ocultar não apaga as posições salvas');
  assert.equal(state.hardware.devices.find(d => d.id === keyboard.id).effects.includes('wave'), true);
});
