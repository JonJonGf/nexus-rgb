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

test('conexao so fica pronta apos ler os componentes e descoberta em etapas mantem varredura antes de recuar', async t => {
  const store = { data: { master: defaults, devices: {} } }, mock = new Mock([]), hardware = new Hardware(store, { makeClient: () => mock }); t.after(() => hardware.stop());
  hardware.stopped = false; await hardware.connect();
  assert.equal(hardware.connected, true); assert.ok(hardware.nextDiscovery - Date.now() <= 1500);
  let resume; const pending = new Promise(resolve => { resume = resolve; });
  mock.devices.push(controller('Detectado primeiro', 'USB:first')); mock.getControllerData = () => pending;
  hardware.connected = false; const connecting = hardware.connect();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(hardware.connected, false);
  resume(mock.devices[0]); await connecting;
  assert.equal(hardware.connected, true); assert.equal(hardware.snapshot().devices.length, 1);
  assert.ok(hardware.nextDiscovery - Date.now() <= 1500, 'Primeira peça detectada não encerra as etapas iniciais.');
  mock.getControllerData = i => mock.devices[i]; await hardware.tick(); mock.calls = [];
  // A second controller finishing its scan without deviceListUpdated is still picked up on the next staged check.
  mock.devices.push(controller('Detectado depois', 'SMBus:ram'));
  hardware.nextDiscovery = 0; await hardware.tick();
  assert.equal(hardware.snapshot().devices.length, 2);
  assert.deepEqual(mock.calls.map(c => c[1]), [1, 1], 'Apenas a controladora nova deve ser configurada.');
  assert.ok(hardware.nextDiscovery - Date.now() <= 1500);
  assert.equal(hardware.detecting, true);
  let changes = 0; hardware.on('change', () => changes++);
  hardware.nextDiscovery = 0; await hardware.tick();
  assert.equal(hardware.detecting, false);
  assert.equal(changes, 1, 'Fim da detecção inicial avisa a interface uma única vez.');
  for (let stage = 0; stage < 5; stage++) { hardware.nextDiscovery = 0; await hardware.tick(); }
  assert.equal(changes, 1, 'Redescoberta sem mudanças não deve reemitir eventos para a interface.');
  assert.ok(hardware.nextDiscovery - Date.now() > 50000);
  assert.equal(typeof hardware.discoveryMs, 'number');
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

test('controladora multizona usa Off nativo somente quando todas as zonas estão apagadas e não reenvia preto em revisões espaciais', async t => {
  const multi = zonedController(); multi.modes.push({ id: 7, name: 'Off', flagList: [] });
  const single = controller('Fita', 'USB:strip');
  const store = { data: { master: { ...defaults, effect: 'wave', brightness: 100 }, devices: {} } };
  const mock = new Mock([multi, single]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect();
  const [board, port1, port2, strip] = hardware.snapshot().devices;
  hardware.studio = { revision: 1, hasDevice: () => true, colorsFor(id, settings, count) { const scale = settings.power ? settings.brightness / 100 : 0; return Array(count).fill({ red: Math.round(200 * scale), green: 0, blue: 0 }); } };
  await hardware.tick(); mock.calls = [];
  // Turning off only two of three zones keeps Direct mode so the remaining zone stays independent.
  store.data.devices[board.id] = { power: false };
  store.data.devices[port1.id] = { power: false };
  hardware.changed(); await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'mode').length, 0);
  assert.deepEqual(mock.calls.find(c => c[0] === 'leds' && c[1] === 0)[2], [{ red: 0, green: 0, blue: 0 }, { red: 0, green: 0, blue: 0 }, { red: 0, green: 0, blue: 0 }, { red: 200, green: 0, blue: 0 }]);
  mock.calls = [];
  // Turning off the last zone (or setting brightness to 0) switches the multi-zone controller to native Off.
  store.data.devices[port2.id] = { brightness: 0 };
  store.data.devices[strip.id] = { power: false };
  hardware.changed(); await hardware.tick();
  assert.deepEqual(mock.calls.filter(c => c[0] === 'mode'), [['mode', 0, 7]]);
  assert.ok(mock.calls.find(c => c[0] === 'leds' && c[1] === 0)[2].every(c => !c.red && !c.green && !c.blue));
  mock.calls = [];
  // Advancing spatial revisions or ticking while off must not resend black frames.
  hardware.studio.revision++; hardware.changed(); await hardware.tick(true); await hardware.tick();
  assert.equal(mock.calls.length, 0);
  // Temporary LED identification exits native Off to Direct, lights only the target LED, and restores native Off after stopping.
  hardware.identify(port1.id, 1); await hardware.tick();
  assert.deepEqual(mock.calls.filter(c => c[0] === 'mode'), [['mode', 0, 2]]);
  assert.deepEqual(mock.calls.find(c => c[0] === 'leds' && c[1] === 0)[2].map(c => c.green), [0, 0, 64, 0]);
  mock.calls = [];
  hardware.identify(port1.id, undefined, true); await hardware.tick();
  assert.deepEqual(mock.calls.filter(c => c[0] === 'mode'), [['mode', 0, 7]]);
  mock.calls = [];
  // Turning on a single zone returns the controller to Direct without lighting the other off zones.
  store.data.devices[port1.id] = { power: true, brightness: 50 };
  hardware.changed(); await hardware.tick();
  assert.deepEqual(mock.calls.filter(c => c[0] === 'mode'), [['mode', 0, 2]]);
  assert.deepEqual(mock.calls.find(c => c[0] === 'leds' && c[1] === 0)[2], [{ red: 0, green: 0, blue: 0 }, { red: 100, green: 0, blue: 0 }, { red: 100, green: 0, blue: 0 }, { red: 0, green: 0, blue: 0 }]);
});

test('transição suave de energia aplica fade em energia geral, individual e Alexa, inverte da intensidade atual, usa fallback em modo nativo e encerra envios ao apagar', async t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { Store } = require('../server/store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-smooth-power-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  store.master({ power: true, color: '#ff0000', brightness: 80, effect: 'static' });
  assert.throws(() => store.performance({ fps: 20, powerTransitionMs: 100 }), /200 a 3000/);
  assert.throws(() => store.performance({ fps: 20, powerTransitionMs: 3500 }), /200 a 3000/);
  store.performance({ fps: 20, powerTransitionMs: 400 });
  assert.equal(store.data.performance.powerTransitionMs, 400);

  let clock = 1000;
  const directDev = controller(' Barra LED ', 'USB:direct', true);
  directDev.modes.push({ id: 7, name: 'Off', flagList: [] });
  const nativeDev = controller('Placa Nativa', 'USB:native', false);
  nativeDev.modes.push({ id: 3, name: 'Static', flagList: ['modeSpecificColor', 'brightness'], brightnessMin: 0, brightnessMax: 100, colorMin: 1, colors: [] });
  nativeDev.modes.push({ id: 7, name: 'Off', flagList: [] });

  const mock = new Mock([directDev, nativeDev]);
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => clock });
  t.after(() => hardware.stop());
  hardware.stopped = false;
  await hardware.connect();
  const [bar, board] = hardware.snapshot().devices;
  store.device(board.id, { nativeMode: 0 }, [bar.id, board.id]);

  // Initial tick applies full target brightness (80% of 255 = 204) without starting a ramp.
  await hardware.tick();
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 204);
  const snap1 = hardware.snapshot().devices;
  assert.equal(snap1.find(d => d.id === bar.id).smoothPowerCapable, true);
  assert.equal(snap1.find(d => d.id === bar.id).powerTransitionFallback, false);
  assert.equal(snap1.find(d => d.id === board.id).smoothPowerCapable, false);
  assert.equal(snap1.find(d => d.id === board.id).powerTransitionFallback, true);

  // Track store.save calls: only the power command itself saves, never the intermediate animation frames.
  let saves = 0;
  const origSave = store.save.bind(store);
  store.save = () => { saves++; return origSave(); };

  // Alexa / general power off (400 ms fade):
  store.power(false);
  hardware.changed();
  assert.equal(saves, 1);
  assert.equal(store.data.master.brightness, 80, 'Brilho salvo não deve mudar');

  // Frame at t=1000 starts ramp (1.0), native device immediately switches to Off mode (id 7):
  mock.calls = [];
  await hardware.tick();
  assert.deepEqual(mock.calls.find(c => c[0] === 'mode' && c[1] === 1), ['mode', 1, 7], 'Modo nativo usa fallback instantâneo');
  assert.equal(hardware.isPowerTransitioning(bar.id), true);

  // Mid-fade at t=1200 (50% elapsed -> mult = 0.5 -> red = 102):
  clock = 1200;
  await hardware.tick();
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 102);
  assert.equal(saves, 1, 'Nenhum salvamento em disco durante os quadros da rampa');

  // Mid-transition reversal at t=1200: turn power back ON!
  // Must start from current intensity (0.5 -> 102) with remaining duration 200 ms, without flash or jump.
  store.power(true);
  hardware.changed();
  assert.equal(saves, 2);
  await hardware.tick();
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 102, 'Reversão parte da intensidade atual sem salto');

  // Halfway through reversed ramp at t=1300 (100 ms of 200 ms -> mult = 0.75 -> red = 153):
  clock = 1300;
  await hardware.tick();
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 153);

  // End of reversed ramp at t=1400 (200 ms of 200 ms -> mult = 1.0 -> red = 204):
  clock = 1400;
  await hardware.tick();
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 204);
  assert.equal(hardware.isPowerTransitioning(bar.id), false);

  // Subsequent ticks on static effect send zero commands:
  mock.calls = [];
  clock = 1500;
  await hardware.tick();
  assert.equal(mock.calls.length, 0);

  // Individual device power off (bar only) fades to 0 and then stops all writes:
  store.device(bar.id, { power: false }, [bar.id, board.id]);
  hardware.changed();
  await hardware.tick(); // t=1500: ramp starts
  clock = 1700;
  await hardware.tick(); // t=1700: 50% (red = 102)
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 102);
  clock = 1900;
  await hardware.tick(); // t=1900: 100% (red = 0, mode Off applied)
  assert.equal(hardware.outputFor(bar.id).colors[0].red, 0);
  assert.equal(hardware.outputFor(bar.id).source, 'off');
  assert.equal(hardware.isPowerTransitioning(bar.id), false);

  // Once off, no further SDK calls are sent on subsequent ticks:
  mock.calls = [];
  clock = 2100;
  await hardware.tick();
  clock = 2300;
  await hardware.tick();
  assert.equal(mock.calls.length, 0, 'Ao apagar, encerrar envios desnecessários');
});

test('timeout ao consultar descricao de componente fecha socket e registra erro especifico', async () => {
  let destroyed = false;
  const mockClient = {
    socket: { destroy() { destroyed = true; } },
    async getControllerCount() { return 2; },
    async getControllerData(i) {
      if (i === 1) return new Promise(() => {});
      return controller('RAM 1', 'SMBus:1');
    }
  };
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mockClient, operationTimeout: 25 });
  hardware.stopped = false;
  hardware.client = mockClient;
  hardware.generation = 1;
  await assert.rejects(
    hardware.discover(),
    /OpenRGB não respondeu ao consultar um componente/
  );
  assert.equal(destroyed, true);
  assert.equal(hardware.lastFailure?.phase, 'controller-description');
  assert.equal(hardware.lastFailure?.controllerIndex, 1);
  assert.equal(hardware.lastFailure?.code, 'ETIMEDOUT');
  hardware.stop();
});

test('evento de desconexao do socket nao substitui timeout significativo por Controlador desconectado', async () => {
  const mock = new Mock([controller('RAM 1', 'SMBus:1')]);
  mock.socket = { destroy() {} };
  mock.getControllerData = async (i) => {
    if (i === 0) return new Promise(() => {});
  };
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock, operationTimeout: 20 });
  hardware.stopped = false;
  await hardware.connect();
  assert.equal(hardware.connected, false);
  assert.match(hardware.error, /OpenRGB não respondeu ao consultar um componente/);
  assert.equal(hardware.lastFailure?.phase, 'controller-description');

  // OpenRGB socket disconnect event triggered after socket destroy:
  mock.emit('disconnect');
  // Error MUST preserve the specific timeout message, NOT overwrite with generic 'Controlador desconectado.'
  assert.match(hardware.error, /OpenRGB não respondeu ao consultar um componente/);
  assert.equal(hardware.lastFailure?.phase, 'controller-description');
  hardware.stop();
});

test('timeout ou callback de conexao antiga nao fecha socket nem afeta conexao nova', async () => {
  let oldDestroyed = false;
  let newDestroyed = false;
  const oldMock = {
    socket: { destroy() { oldDestroyed = true; } },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() { return new Promise(() => {}); }
  };
  const newMock = {
    socket: { destroy() { newDestroyed = true; } },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() { return controller('Novo', 'USB:new'); }
  };
  let currentMock = oldMock;
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => currentMock, operationTimeout: 50 });
  hardware.stopped = false;
  hardware.connect();
  await new Promise(r => setTimeout(r, 10));
  currentMock = newMock;
  hardware.busy = false;
  await hardware.connect();
  assert.equal(hardware.connected, true);
  assert.equal(hardware.devices[0].name, 'Novo');
  await new Promise(r => setTimeout(r, 60));
  assert.equal(oldDestroyed, true);
  assert.equal(newDestroyed, false);
  assert.equal(hardware.connected, true);
  hardware.stop();
});

test('resposta tardia de conexao antiga nao altera estado da nova geracao', async () => {
  let resolveLate;
  const latePromise = new Promise(resolve => { resolveLate = resolve; });
  const oldMock = {
    socket: { destroy() {} },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() { return latePromise; }
  };
  const newMock = {
    socket: { destroy() {} },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() { return controller('Correto', 'USB:valid'); }
  };
  let client = oldMock;
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => client });
  hardware.stopped = false;
  hardware.connect();
  await new Promise(r => setImmediate(r));
  client = newMock;
  hardware.busy = false;
  await hardware.connect();
  assert.equal(hardware.devices[0].name, 'Correto');
  resolveLate(controller('Antigo Obsoleto', 'USB:old'));
  await new Promise(r => setImmediate(r));
  assert.equal(hardware.devices[0].name, 'Correto');
  hardware.stop();
});

test('temporizadores de operacao sao cancelados e stop limpa todos os timers e sockets', async () => {
  let destroyed = false;
  const mock = {
    socket: { destroy() { destroyed = true; } },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() { return controller('Peca', 'USB:1'); }
  };
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock });
  hardware.stopped = false;
  await hardware.connect();
  assert.equal(hardware.activeTimers.size, 0);
  hardware.stop();
  assert.equal(destroyed, true);
  assert.equal(hardware.activeTimers.size, 0);
  assert.equal(hardware.stopped, true);
});

test('stop durante descoberta cancela operacao e nao deixa estado inconsistente', async () => {
  let destroyed = false;
  const mock = {
    socket: { destroy() { destroyed = true; } },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() {
      hardware.stop();
      return controller('Cancelado', 'USB:cancel');
    }
  };
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock });
  hardware.stopped = false;
  await hardware.connect();
  assert.equal(hardware.connected, false);
  assert.equal(hardware.stopped, true);
  assert.equal(destroyed, true);
  assert.equal(hardware.devices.length, 0);
});

test('recuperacao apos falha restabelece conexao e zera historico de travamento', async () => {
  let shouldFail = true;
  const mock = {
    socket: { destroy() {} },
    on() {},
    async connect() {},
    async getControllerCount() { return 1; },
    async getControllerData() {
      if (shouldFail) return new Promise(() => {});
      return controller('Recuperado', 'USB:ok');
    }
  };
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock, operationTimeout: 20 });
  hardware.stopped = false;
  await hardware.connect();
  assert.equal(hardware.connected, false);
  assert.equal(hardware.consecutiveDescriptionHangs, 1);
  assert.ok(hardware.lastFailure);

  shouldFail = false;
  await hardware.connect();
  assert.equal(hardware.connected, true);
  assert.equal(hardware.consecutiveDescriptionHangs, 0);
  assert.equal(hardware.controllerHung, false);
  assert.equal(hardware.lastFailure, null);
  assert.equal(hardware.snapshot().devices[0].status, 'online');
  hardware.stop();
});

test('diagnostico reporta componentes offline, stale e erro estruturado sem vazar dados', async () => {
  const { diagnostics } = require('../server/diagnostics');
  const mock = new Mock([controller('RAM 1', 'SMBus:1')]);
  const store = { data: { master: defaults, devices: {} } };
  const hardware = new Hardware(store, { makeClient: () => mock });
  hardware.stopped = false;
  await hardware.connect();
  assert.equal(hardware.snapshot().devices[0].status, 'online');

  hardware.controllerHung = true;
  hardware.lost(new Error('OpenRGB não respondeu ao consultar um componente.'));
  hardware.lastFailure = {
    code: 'ETIMEDOUT',
    phase: 'controller-description',
    timeoutMs: 4000,
    controllerIndex: 1,
    generation: 2,
    firstOccurredAt: Date.now() - 1000,
    lastOccurredAt: Date.now(),
    count: 3
  };

  const snap = hardware.snapshot();
  assert.equal(snap.connected, false);
  assert.equal(snap.controllerHung, true);
  assert.equal(snap.devices[0].status, 'offline');
  assert.equal(snap.devices[0].stale, true);

  const diag = diagnostics(hardware, { hadController: true, config: {} }, store, null);
  assert.equal(diag.health.state, 'controller-hung');
  assert.equal(diag.health.connected, false);
  assert.equal(diag.health.controllerHung, true);
  assert.equal(diag.components[0].status, 'offline');
  assert.equal(diag.errors.controllerHung, true);
  assert.equal(diag.errors.hardwareErrorCode, 'controller-hung');
  assert.deepEqual(diag.errors.lastFailure, snap.lastFailure);
  const serialized = JSON.stringify(diag);
  assert.ok(!serialized.includes('serial'));
  assert.ok(!serialized.includes('location'));
  hardware.stop();
});

test('assinatura de 3 falhas consecutivas de descricao ativa controllerHung; erro de connect nao ativa', async () => {
  let failPhase = 'description';
  const mock = {
    socket: { destroy() {} },
    on() {},
    async connect() {
      if (failPhase === 'connect') throw Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
    },
    async getControllerCount() { return 1; },
    async getControllerData() {
      if (failPhase === 'description') return new Promise(() => {});
      return controller('OK', 'USB:1');
    }
  };
  const hardware = new Hardware({ data: { master: defaults, devices: {} } }, { makeClient: () => mock, operationTimeout: 15 });
  hardware.stopped = false;

  await hardware.connect();
  assert.equal(hardware.consecutiveDescriptionHangs, 1);
  assert.equal(hardware.controllerHung, false);

  await hardware.connect();
  assert.equal(hardware.consecutiveDescriptionHangs, 2);
  assert.equal(hardware.controllerHung, false);

  await hardware.connect();
  assert.equal(hardware.consecutiveDescriptionHangs, 3);
  assert.equal(hardware.controllerHung, true);

  failPhase = 'connect';
  await hardware.connect();
  assert.equal(hardware.consecutiveDescriptionHangs, 0);
  hardware.stop();
});

test('ligar e desligar mantem sincronia perfeita de animacao entre componentes com tempos diferentes', async () => {
  const store = { data: { master: { ...defaults, effect: 'wave', speed: 50 }, devices: {} } };
  const mock = new Mock([controller('Motherboard', 'USB:board'), controller('RAM', 'SMBus:ram')]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  hardware.stopped = false;
  await hardware.connect();
  const boardId = hardware.devices[0].id;
  const ramId = hardware.devices[1].id;

  const boardFrame1 = hardware.renderFrame(boardId, store.data.master, 4, 10.0, 10000);
  const ramFrame1 = hardware.renderFrame(ramId, store.data.master, 4, 10.4, 10400);

  store.data.master.power = false;
  const boardOff = hardware.renderFrame(boardId, store.data.master, 4, 11.0, 11000);
  const ramOff = hardware.renderFrame(ramId, store.data.master, 4, 11.0, 11000);
  assert.ok(boardOff.every(c => c.red === 0 && c.green === 0 && c.blue === 0));
  assert.ok(ramOff.every(c => c.red === 0 && c.green === 0 && c.blue === 0));

  store.data.master.power = true;
  const boardOn = hardware.renderFrame(boardId, store.data.master, 4, 20.0, 20000);
  const ramOn = hardware.renderFrame(ramId, store.data.master, 4, 20.0, 20000);
  assert.deepEqual(boardOn, ramOn, 'Placa-mãe e RAM devem ter fases de animação 100% idênticas ao religar');
  hardware.stop();
});

test('rotulos de falha e botao de recuperacao estao traduzidos no en.js', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const enSource = fs.readFileSync(path.join(__dirname, '../public/en.js'), 'utf8');
  assert.ok(enSource.includes('"OpenRGB não respondeu ao consultar um componente."'));
  assert.ok(enSource.includes('"OpenRGB did not respond while querying a component."'));
  assert.ok(enSource.includes('"Reiniciar controlador"'));
  assert.ok(enSource.includes('"Restart controller"'));
  assert.ok(enSource.includes('"● OpenRGB sem resposta"'));
});
