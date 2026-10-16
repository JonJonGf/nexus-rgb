'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const { EventEmitter } = require('node:events');
const { Hardware, frame } = require('../server/hardware'); const { defaults } = require('../server/store');
function controller(name, location, direct = true) { return { name, vendor: 'Fornecedor', serial: '', location, type: 2, colors: Array(4).fill({ red: 0, green: 0, blue: 0 }), zones: [], modes: [{ id: 0, name: 'Rainbow', flagList: [] }, ...(direct ? [{ id: 2, name: 'Direct', flagList: ['perLedColor'] }] : [])] }; }
class Mock extends EventEmitter { constructor(devices) { super(); this.devices = devices; this.calls = []; } async connect() {} async getControllerCount() { return this.devices.length; } async getControllerData(i) { return this.devices[i]; } async updateMode(id, mode) { this.calls.push(['mode', id, mode.id]); } updateLeds(id, colors) { this.calls.push(['leds', id, colors]); } disconnect() {} }

test('transição de perfil é limitada, termina no alvo e desligamento não espera a mistura',async t=>{
  const store={data:{master:{...defaults,brightness:100,color:'#0000ff'},devices:{}}},mock=new Mock([controller('Alvo','transition')]),hardware=new Hardware(store,{makeClient:()=>mock});t.after(()=>hardware.stop());hardware.stopped=false;await hardware.connect();await hardware.tick();const id=hardware.devices[0].id;
  store.data.master.color='#ff0000';hardware.transition(1000);hardware.transitionState.started-=500;await hardware.tick();const mixed=hardware.outputFor(id).colors[0];assert.ok(mixed.red>100&&mixed.red<200);assert.ok(mixed.blue>50&&mixed.blue<155);
  store.data.master.power=false;hardware.changed();await hardware.tick();assert.deepEqual(hardware.outputFor(id).colors[0],{red:0,green:0,blue:0});
  store.data.master.power=true;hardware.transitionState.started-=1000;hardware.changed();await hardware.tick();assert.deepEqual(hardware.outputFor(id).colors[0],{red:255,green:0,blue:0});assert.equal(hardware.transitionState,null);mock.calls=[];await hardware.tick();assert.equal(mock.calls.length,0);
});

test('identificação afeta somente o alvo, não salva ajustes e restaura desligamento e modo nativo', async t => {
  const store={data:{master:{...defaults,power:false},devices:{}}},mock=new Mock([controller('Alvo','one'),controller('Outro','two')]),hardware=new Hardware(store,{makeClient:()=>mock});t.after(()=>hardware.stop());
  hardware.stopped=false;await hardware.connect();await hardware.tick();const id=hardware.devices[0].id,before=JSON.stringify(store.data);mock.calls=[];
  hardware.identify(id,2);await hardware.tick();
  assert.deepEqual(mock.calls.filter(c=>c[0]==='leds').map(c=>c[1]),[0]);assert.deepEqual(mock.calls.at(-1)[2].map(c=>c.green),[0,0,64,0]);assert.equal(hardware.outputFor(id).source,'identify');
  hardware.identify(id,undefined,true);await hardware.tick();assert.ok(hardware.outputFor(id).colors.every(c=>!c.red&&!c.green&&!c.blue));assert.equal(JSON.stringify(store.data),before);
  store.data.master.power=true;store.data.devices[id]={nativeMode:0};hardware.changed();await hardware.tick();
  hardware.identify(id);await hardware.tick();hardware.identify(id,undefined,true);await hardware.tick();assert.equal(hardware.outputFor(id).source,'native');assert.deepEqual(mock.calls.at(-1),['mode',0,0]);
  assert.throws(()=>hardware.identify(id,4));assert.throws(()=>hardware.identify('f'.repeat(24),0));
});

test('conexao so fica pronta apos ler os componentes e lista vazia tenta novamente rapidamente', async t => {
  const store = { data: { master: defaults, devices: {} } }, mock = new Mock([]), hardware = new Hardware(store, { makeClient: () => mock }); t.after(() => hardware.stop());
  hardware.stopped = false; await hardware.connect();
  assert.equal(hardware.connected, true); assert.ok(hardware.nextDiscovery - Date.now() <= 1500);
  let resume; const pending = new Promise(resolve => { resume = resolve; });
  mock.devices.push(controller('Detectado depois', 'USB:late')); mock.getControllerData = () => pending;
  hardware.connected = false; const connecting = hardware.connect();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(hardware.connected, false);
  resume(mock.devices[0]); await connecting;
  assert.equal(hardware.connected, true); assert.equal(hardware.snapshot().devices.length, 1);
  assert.ok(hardware.nextDiscovery - Date.now() > 25000);
});

test('mapa atualiza LEDs uma vez por quadro e restaura estático ou modo nativo ao sair', async t => {
  const store = { data: { master: { ...defaults, brightness: 100, color: '#ff0000' }, devices: {} } };
  const mock = new Mock([controller('RAM', 'USB:map')]), hardware = new Hardware(store, { makeClient: () => mock }); t.after(() => hardware.stop());
  hardware.stopped = false; await hardware.connect(); await hardware.tick(); const id = hardware.devices[0].id;
  let active = true;
  hardware.studio = { revision: 1, hasDevice: target => active && target === id, colorsFor(target, settings, count) { return active ? Array(count).fill({ red: 0, green: settings.power ? 255 : 0, blue: 0 }) : null; } };
  hardware.changed(); await hardware.tick(); assert.equal(mock.calls.at(-1)[2][0].green, 255);
  assert.deepEqual(hardware.outputFor(id).colors, mock.calls.at(-1)[2]);
  mock.calls = []; await hardware.tick(); assert.equal(mock.calls.length, 0, 'Não reenviar um quadro que não mudou.');
  hardware.studio.revision++; hardware.changed(); await hardware.tick(); assert.equal(mock.calls.length, 1); assert.equal(mock.calls[0][0], 'leds');
  active = false; hardware.changed(); await hardware.tick(); assert.deepEqual(mock.calls.at(-1)[2][0], { red: 255, green: 0, blue: 0 });
  store.data.devices[id] = { nativeMode: 0 }; hardware.changed(); await hardware.tick(); assert.deepEqual(mock.calls.at(-1), ['mode', 0, 0]);
  active = true; hardware.changed(); await hardware.tick(); assert.equal(mock.calls.at(-1)[2][0].green, 255);
  active = false; hardware.changed(); await hardware.tick(); assert.deepEqual(mock.calls.at(-1), ['mode', 0, 0]);
  assert.equal(hardware.outputFor(id).colors, null); assert.equal(hardware.outputFor(id).source, 'native');
});

test('envio imediato do mapa não duplica a taxa de efeitos comuns de outros dispositivos', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave' }, devices: {} } };
  const mock = new Mock([controller('Mapa', 'USB:spatial'), controller('Onda individual', 'USB:wave')]);
  const hardware = new Hardware(store, { makeClient: () => mock }); t.after(() => hardware.stop());
  hardware.stopped = false; await hardware.connect(); const target = hardware.devices[0].id;
  hardware.studio = { revision: 1, hasDevice: id => id === target, colorsFor: () => null };
  await hardware.tick(); mock.calls = []; hardware.studio.revision++; hardware.changed();
  await hardware.tick(true); assert.deepEqual(mock.calls.filter(c => c[0] === 'leds').map(c => c[1]), [0]);
  mock.calls = []; await hardware.tick(); assert.deepEqual(mock.calls.filter(c => c[0] === 'leds').map(c => c[1]), [1]);
});
test('detecta marcas e quantidades arbitrárias e escolhe Direct pelo modo real', async () => {
  const store = { data: { master: { ...defaults }, devices: {} } }; const mock = new Mock([controller('Teclado genérico', 'USB:1'), controller('GPU genérica', 'PCI:2')]);
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  assert.equal(hardware.snapshot().devices.length, 2); assert.deepEqual(mock.calls.filter(c => c[0] === 'mode').map(c => c[2]), [2, 2]); assert.equal(mock.calls.find(c => c[0] === 'leds')[2].length, 4); hardware.stop();
});
test('dispositivo sem Direct não recebe efeitos nem LED writes inválidos', async () => {
  const store = { data: { master: { ...defaults, effect: 'wave' }, devices: {} } }; const mock = new Mock([controller('Dispositivo restrito', 'USB:1', false)]);
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  assert.equal(mock.calls.length, 0); assert.match(hardware.snapshot().devices[0].error, /não oferece/); hardware.stop();
});
test('reordenação dos índices SDK mantém identidades físicas', async () => {
  const mock = new Mock([controller('A', 'USB:1'), controller('B', 'USB:2')]); const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect();
  const ids = Object.fromEntries(hardware.devices.map(d => [d.name, d.id])); mock.devices.reverse(); await hardware.discover(); for (const d of hardware.devices) assert.equal(d.id, ids[d.name]); hardware.stop();
});
test('desligar zera todos os LEDs sem depender da cor ou efeito', () => {
  assert.ok(frame({ ...defaults, effect: 'wave', power: false }, 40, 123).every(c => c.red === 0 && c.green === 0 && c.blue === 0));
});
test('timeout de SDK encerra socket e permite recuperar conexão', async () => {
  const hardware = new Hardware({ data: {} }); let destroyed = false; hardware.client = { socket: { destroy() { destroyed = true; } } }; await assert.rejects(hardware.operation(new Promise(() => {}), 10), /não respondeu/); assert.equal(destroyed, true);
});
test('modo Off nativo desliga hardware sem Direct e preserva modo selecionado para religar', async () => {
  const raw = controller('Nativo', 'USB:3', false); raw.modes.push({ id: 7, name: 'Off', flagList: [] });
  const store = { data: { master: { ...defaults, power: false }, devices: {} } }; const mock = new Mock([raw]);
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  assert.deepEqual(mock.calls[0], ['mode', 0, 7]); assert.equal(hardware.snapshot().devices[0].error, null); hardware.stop();
});
test('eventos de socket antigo não derrubam uma conexão já substituída', async () => {
  const old = new Mock([]); const fresh = new Mock([]); let current = old;
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => current }); hardware.stopped = false; await hardware.connect(); current = fresh; await hardware.connect(); old.emit('disconnect'); assert.equal(hardware.connected, true); hardware.stop();
});

test('paletas de cenas não escapam das cores escolhidas e respeitam desligamento', () => {
  const settings = { ...defaults, brightness: 100, effect: 'wave', palette: ['#ff0000', '#0000ff'] };
  const colors = frame(settings, 120, 1.5); assert.ok(colors.some(c => c.red > 0 && c.blue > 0)); assert.ok(colors.every(c => c.green === 0));
  assert.ok(frame({ ...settings, power: false }, 120, 12).every(c => Object.values(c).every(v => v === 0)));
});

test('restaura quantidade de LEDs por identidade física após novo controlador', async () => {
  const { identity } = require('../server/hardware'); const raw = controller('Header ARGB', 'USB:stable'); raw.zones = [{ id: 0, name: 'ARGB', resizable: true, ledsMin: 0, ledsMax: 120, ledsCount: 0 }]; raw.colors = [];
  const store = { data: { master: defaults, devices: {}, zones: { [identity(raw)]: { 0: 36 } } } };
  const mock = new Mock([raw]); mock.resizeZone = (id, zone, count) => { raw.zones[zone].ledsCount = count; raw.colors = Array(count).fill({ red: 0, green: 0, blue: 0 }); };
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); assert.equal(hardware.snapshot().devices[0].ledCount, 36); hardware.stop();
});

function zonedController() {
  const raw = controller('Controladora de outra marca', 'USB:controller');
  raw.zones = [
    { id: 0, name: 'LED interno', ledsCount: 1, ledsMin: 1, ledsMax: 1, resizable: false },
    { id: 1, name: 'Addressable RGB Header 1', ledsCount: 2, ledsMin: 0, ledsMax: 120, resizable: true },
    { id: 2, name: 'Addressable RGB Header 2', ledsCount: 1, ledsMin: 0, ledsMax: 120, resizable: true }
  ]; return raw;
}
test('separa zonas de qualquer fabricante e compõe cores sem sobrescrever outra porta', async () => {
  const store = { data: { master: { ...defaults, color: '#ff0000', brightness: 100 }, devices: {} } };
  const mock = new Mock([zonedController()]); const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect();
  const before = hardware.snapshot(); assert.equal(before.controllerCount, 1); assert.equal(before.devices.length, 3);
  const [board, port1, port2] = before.devices; assert.equal(port1.name, 'ARGB 1'); assert.equal(port2.name, 'ARGB 2'); assert.deepEqual(port1.modes, []);
  store.data.devices[port1.id] = { color: '#00ff00', brightness: 50 };
  store.data.devices[port2.id] = { power: false };
  await hardware.tick();
  const writes = mock.calls.filter(c => c[0] === 'leds'); assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][2], [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 128, blue: 0 }, { red: 0, green: 128, blue: 0 }, { red: 0, green: 0, blue: 0 }]);
  assert.equal(hardware.snapshot().devices.find(d => d.id === board.id).settings.color, '#ff0000');
  hardware.stop();
});
test('portas mantêm identidade ao redimensionar e salvar usa a controladora física', async () => {
  const raw = zonedController(); const store = { data: { master: defaults, devices: {}, zones: {} }, zone(id, zone, count) { this.data.zones[id] ??= {}; this.data.zones[id][zone] = count; } };
  const mock = new Mock([raw]); mock.resizeZone = (id, zone, count) => { raw.zones[zone].ledsCount = count; raw.colors = Array(raw.zones.reduce((sum, z) => sum + z.ledsCount, 0)).fill({ red: 0, green: 0, blue: 0 }); };
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect();
  const port = hardware.snapshot().devices.find(d => d.name === 'ARGB 1'); const physicalId = hardware.devices[0].id;
  await assert.rejects(hardware.resize(port.id, 2, 10), /inválido/);
  await hardware.resize(port.id, 1, 5);
  assert.equal(hardware.snapshot().devices.find(d => d.id === port.id).ledCount, 5); assert.equal(store.data.zones[physicalId][1], 5);
  assert.equal(store.data.zones[port.id], undefined); hardware.stop();
});

test('desconexão durante redimensionamento recupera o controlador e preserva quantidade salva', async () => {
  const { identity } = require('../server/hardware'); const raw = zonedController();
  const physicalId = identity(raw), store = { data: { master: defaults, devices: {}, zones: { [physicalId]: { 1: 2 } } } };
  const mock = new Mock([raw]);
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect();
  const port = hardware.snapshot().devices.find(d => d.name === 'ARGB 1');
  mock.resizeZone = () => { mock.emit('disconnect'); };
  mock.getControllerCount = async () => { throw new Error('Controlador desconectado durante ajuste.'); };
  await assert.rejects(hardware.resize(port.id, 1, 6), /desconectado/);
  assert.equal(hardware.connected, false); assert.equal(hardware.busy, false);
  assert.ok(hardware.reconnect, 'O supervisor deve agendar nova conexão após liberar busy.');
  assert.equal(store.data.zones[physicalId][1], 2);
  hardware.stop();
});
test('não adivinha offsets quando as zonas não cobrem todos os LEDs', async () => {
  const raw = zonedController(); raw.zones[1].ledsCount = 1;
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => new Mock([raw]) }); hardware.stopped = false; await hardware.connect();
  assert.equal(hardware.snapshot().devices.length, 1); assert.equal(hardware.snapshot().devices[0].ledCount, 4); hardware.stop();
});
test('lista atualizada pelo OpenRGB detecta nova controladora sem reiniciar o Nexus', async () => {
  const mock = new Mock([controller('Inicial', 'USB:1')]); const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  mock.devices.push(zonedController()); mock.emit('deviceListUpdated'); await hardware.tick();
  assert.equal(hardware.snapshot().controllerCount, 2); assert.equal(hardware.snapshot().devices.length, 4); hardware.stop();
});

test('mudar uma cor atualiza somente a controladora alvo e preserva o modo Direct', async () => {
  const store = { data: { master: { ...defaults }, devices: {} } }; const mock = new Mock([controller('RAM A', 'USB:1'), controller('RAM B', 'USB:2')]);
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  mock.calls = []; const target = hardware.snapshot().devices[0]; store.data.devices[target.id] = { color: '#ff0000' }; hardware.changed(); await hardware.tick();
  assert.equal(mock.calls.filter(call => call[0] === 'mode').length, 0);
  assert.deepEqual(mock.calls.filter(call => call[0] === 'leds').map(call => call[1]), [0]); hardware.stop();
});
test('descoberta periódica e troca da lista não reprogramam controladoras existentes', async () => {
  const mock = new Mock([controller('RAM A', 'USB:1'), zonedController()]); const hardware = new Hardware({ data: { master: { ...defaults }, devices: {} } }, { makeClient: () => mock });
  hardware.stopped = false; await hardware.connect(); await hardware.tick(); mock.calls = [];
  hardware.nextDiscovery = 0; await hardware.tick(); assert.equal(mock.calls.length, 0);
  mock.devices.push(controller('Novo dispositivo', 'USB:new')); mock.emit('deviceListUpdated'); await hardware.tick();
  assert.ok(mock.calls.length); assert.ok(mock.calls.every(call => call[1] === 2)); hardware.stop();
});
test('alterar só uma porta compõe suas cores sem trocar modo ou tocar outra controladora', async () => {
  const store = { data: { master: { ...defaults }, devices: {} } }; const mock = new Mock([zonedController(), controller('RAM', 'USB:ram')]);
  const hardware = new Hardware(store, { makeClient: () => mock }); hardware.stopped = false; await hardware.connect(); await hardware.tick(); mock.calls = [];
  const port = hardware.snapshot().devices.find(device => device.name === 'ARGB 1'); store.data.devices[port.id] = { power: false }; hardware.changed(); await hardware.tick();
  assert.equal(mock.calls.length, 1); assert.equal(mock.calls[0][0], 'leds'); assert.equal(mock.calls[0][1], 0);
  assert.deepEqual(mock.calls[0][2].slice(1,3), [{red:0,green:0,blue:0},{red:0,green:0,blue:0}]);
  assert.ok(mock.calls[0][2][0].green > 0); assert.ok(mock.calls[0][2][3].green > 0); hardware.stop();
});
test('cache de modo mantém alterações necessárias de brilho nos modos nativos', async () => {
  const raw = controller('Luz nativa', 'USB:native', false); raw.modes.push({id:3,name:'Static',flagList:['modeSpecificColor','brightness'],brightnessMin:0,brightnessMax:100,colorMin:1,colors:[]});
  const store = {data:{master:{...defaults},devices:{}}}; const mock = new Mock([raw]); const configs = []; mock.updateMode = async (id, mode) => {configs.push(mode);};
  const hardware = new Hardware(store,{makeClient:()=>mock}); hardware.stopped=false; await hardware.connect(); await hardware.tick();
  const id = hardware.snapshot().devices[0].id; store.data.devices[id]={brightness:20}; hardware.changed(); await hardware.tick();
  assert.equal(configs.length,2); assert.equal(configs[1].brightness,20); assert.deepEqual(configs[1].colors,[{red:0,green:240,blue:255}]); hardware.stop();
});

test('energia geral apaga zonas e modos nativos sem perder ajustes ou religar componentes desativados', async t => {
  const native = controller('Nativo', 'USB:native', false); native.modes.push({ id: 7, name: 'Off', flagList: [] });
  const store = { data: { master: { ...defaults, color: '#ff0000', brightness: 100 }, devices: {} } };
  const mock = new Mock([zonedController(), native]); const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect();
  const [board, port1, port2, lamp] = hardware.snapshot().devices;
  store.data.devices[port1.id] = { power: true, color: '#00ff00', brightness: 50 };
  store.data.devices[port2.id] = { power: false };
  store.data.devices[lamp.id] = { power: true, nativeMode: 0 };
  const overrides = structuredClone(store.data.devices);
  await hardware.tick(); mock.calls = [];
  store.data.master.power = false; hardware.changed(); await hardware.tick();
  assert.ok(mock.calls.find(call => call[0] === 'leds')[2].every(color => Object.values(color).every(value => value === 0)));
  assert.deepEqual(mock.calls.find(call => call[0] === 'mode'), ['mode', 1, 7]);
  assert.ok(hardware.snapshot().devices.every(device => device.settings.power === false));
  assert.deepEqual(store.data.devices, overrides); mock.calls = [];
  store.data.master.power = true; hardware.changed(); await hardware.tick();
  assert.deepEqual(mock.calls.find(call => call[0] === 'leds')[2], [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 128, blue: 0 }, { red: 0, green: 128, blue: 0 }, { red: 0, green: 0, blue: 0 }]);
  assert.deepEqual(mock.calls.find(call => call[0] === 'mode'), ['mode', 1, 0]);
  assert.equal(hardware.snapshot().devices.find(device => device.id === board.id).settings.power, true);
  assert.deepEqual(store.data.devices, overrides);
});
