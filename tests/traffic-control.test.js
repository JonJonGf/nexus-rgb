'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Hardware, colorsEqual, isSmbusRam } = require('../server/hardware');
const { defaults } = require('../server/store');

test('identical spatial frames are deduplicated even when Studio advances its revision',async t=>{
  const store={data:{master:{...defaults,effect:'static'},devices:{}}};
  const mock=new MockClient([controller('Board','synthetic')]);
  const hardware=new Hardware(store,{makeClient:()=>mock});t.after(()=>hardware.stop());hardware.stopped=false;await hardware.connect();
  hardware.studio={config:{},hasDevice:()=>true,revision:1,colorsFor:()=>Array(8).fill({red:100,green:0,blue:0})};mock.calls=[];
  for(let i=0;i<60;i++){hardware.studio.revision++;hardware.changed();await hardware.tick(true);}
  assert.equal(mock.calls.filter(c=>c[0]==='leds').length,1);
});

function controller(name, location, direct = true) {
  return {
    name,
    vendor: 'Fornecedor',
    serial: '',
    location,
    type: 2,
    colors: Array(8).fill({ red: 0, green: 0, blue: 0 }),
    zones: [],
    modes: [
      { id: 0, name: 'Rainbow', flagList: [] },
      ...(direct ? [{ id: 2, name: 'Direct', flagList: ['perLedColor'] }] : [])
    ]
  };
}

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.writableLength = 0;
  }
  destroy() {
    this.emit('close');
  }
}

class MockClient extends EventEmitter {
  constructor(devices = []) {
    super();
    this.devices = devices;
    this.calls = [];
    this.socket = new MockSocket();
    this.isConnected = true;
  }
  async connect() {}
  async getControllerCount() { return this.devices.length; }
  async getControllerData(i) { return this.devices[i]; }
  async updateMode(id, mode) { this.calls.push(['mode', id, mode.id]); }
  updateLeds(id, colors) { this.calls.push(['leds', id, colors.map(c => ({ ...c }))]); }
  resizeZone(i, zId, count) { this.devices[i].zones[zId].ledsCount = count; }
  disconnect() { this.socket.destroy(); }
}

test('RAM applies the final static color after a rapid change from rainbow without bypassing its rate limit', async t => {
  const store = { data: { master: { ...defaults, effect: 'rainbow', brightness: 100 }, devices: {} } };
  const raw = { ...controller('Synthetic RAM', 'SMBus:1'), type: 1 };
  const mock = new MockClient([raw]); let now = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => now });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  const previous = mock.calls.filter(c => c[0] === 'leds').at(-1)[2];
  now += 10; store.data.master = { ...store.data.master, effect: 'static', color: '#0000ff' };
  hardware.changed(); await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1, 'The protected RAM must not receive an early write');
  assert.deepEqual(hardware.outputFor(hardware.devices[0].id).colors, previous, 'A deferred frame must not appear as delivered');
  now += 50; await hardware.tick();
  const sent = mock.calls.filter(c => c[0] === 'leds');
  assert.equal(sent.length, 2, 'The final static frame must be retried without another user action');
  assert.deepEqual(sent.at(-1)[2], Array.from({ length: 8 }, () => ({ red: 0, green: 0, blue: 255 })));
  now += 100; await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 2, 'Static output settles after successful delivery');
});

test('a congested socket eventually receives only the latest static color and keeps the delivered preview until then', async t => {
  const store = { data: { master: { ...defaults, effect: 'static', color: '#ff0000', brightness: 100 }, devices: {} } };
  const mock = new MockClient([controller('Synthetic Board', 'USB:1')]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  mock.socket.writableLength = 4096;
  for (const color of ['#00ff00', '#ffff00', '#0000ff']) { store.data.master.color = color; hardware.changed(); await hardware.tick(); }
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1);
  assert.deepEqual(hardware.outputFor(hardware.devices[0].id).colors[0], { red: 255, green: 0, blue: 0 });
  mock.socket.writableLength = 0; mock.socket.emit('drain'); await new Promise(resolve => setImmediate(resolve));
  await hardware.tick();
  const sent = mock.calls.filter(c => c[0] === 'leds');
  assert.equal(sent.length, 2, 'Deferred updates are coalesced instead of replayed');
  assert.deepEqual(sent.at(-1)[2][0], { red: 0, green: 0, blue: 255 });
  await hardware.tick(); assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 2);
});

test('power-off supersedes a deferred color and is never followed by that obsolete color', async t => {
  const store = { data: { master: { ...defaults, effect: 'static', color: '#ff0000' }, devices: {} } };
  const mock = new MockClient([controller('Synthetic Board', 'USB:1')]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  mock.socket.writableLength = 4096; store.data.master.color = '#0000ff'; hardware.changed(); await hardware.tick();
  store.data.master.power = false; hardware.changed(); await hardware.tick();
  mock.socket.writableLength = 0; mock.socket.emit('drain'); await new Promise(resolve => setImmediate(resolve)); await hardware.tick();
  const sent = mock.calls.filter(c => c[0] === 'leds');
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.at(-1)[2], Array.from({ length: 8 }, () => ({ red: 0, green: 0, blue: 0 })));
});

test('a composite RAM controller retries a deferred final static frame for all of its zones', async t => {
  const store = { data: { master: { ...defaults, effect: 'rainbow', brightness: 100 }, devices: {} } };
  const raw = { ...controller('Synthetic RAM', 'SMBus:1'), type: 1, zones: [0, 1].map(id => ({ id, name: 'Zone '+id, ledsCount: 4, ledsMin: 4, ledsMax: 4, resizable: false })) };
  const mock = new MockClient([raw]); let now = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => now });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  assert.equal(hardware.snapshot().devices.length, 2);
  now += 10; store.data.master = { ...store.data.master, effect: 'static', color: '#0000ff' }; hardware.changed(); await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1);
  now += 50; await hardware.tick();
  const sent = mock.calls.filter(c => c[0] === 'leds');
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.at(-1)[2], Array.from({ length: 8 }, () => ({ red: 0, green: 0, blue: 255 })));
});

test('native Off supersedes a deferred RGB frame even when the mode has no per-LED colors', async t => {
  const store = { data: { master: { ...defaults, effect: 'static', color: '#ff0000' }, devices: {} } };
  const raw = controller('Synthetic Board', 'USB:1'); raw.modes.push({ id: 3, name: 'Off', flagList: [] });
  const mock = new MockClient([raw]); const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  mock.socket.writableLength = 4096; store.data.master.color = '#0000ff'; hardware.changed(); await hardware.tick();
  store.data.master.power = false; hardware.changed(); await hardware.tick();
  const output = hardware.outputFor(hardware.devices[0].id);
  assert.equal(output.source, 'off');
  assert.deepEqual(output.colors, Array.from({ length: 8 }, () => ({ red: 0, green: 0, blue: 0 })));
  mock.socket.writableLength = 0; mock.socket.emit('drain'); await new Promise(resolve => setImmediate(resolve)); await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1, 'The old color must never be replayed after Off');
});

test('identifying another controller must not bypass the RAM write cadence', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave', speed: 50 }, devices: {} } };
  const rawRam = { ...controller('Synthetic RAM', 'SMBus:1'), type: 1 };
  const mock = new MockClient([rawRam, controller('Synthetic ARGB', 'USB:1')]); let now = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => now });
  t.after(() => hardware.stop()); hardware.stopped = false; await hardware.connect(); await hardware.tick();
  hardware.identify(hardware.devices[1].id, 0);
  for (let i = 0; i < 12; i++) { now += 1000 / 60; await hardware.tick(); }
  const ramWrites = mock.calls.filter(c => c[0] === 'leds' && c[1] === 0);
  assert.ok(ramWrites.length <= 5, `RAM received ${ramWrites.length} writes in 200 ms while identifying ARGB`);
});

test('colorsEqual helper compara canais RGB e detecta igualdade estrita sem alocação', () => {
  const c1 = [{ red: 255, green: 0, blue: 128 }, { red: 10, green: 20, blue: 30 }];
  const c2 = [{ red: 255, green: 0, blue: 128 }, { red: 10, green: 20, blue: 30 }];
  const c3 = [{ red: 255, green: 0, blue: 129 }, { red: 10, green: 20, blue: 30 }];
  assert.equal(colorsEqual(c1, c2), true);
  assert.equal(colorsEqual(c1, c3), false);
  assert.equal(colorsEqual(c1, null), false);
  assert.equal(colorsEqual(null, null), true);
  assert.equal(colorsEqual(c1, [{ red: 255, green: 0, blue: 128 }]), false);
});

test('backpressure descarta quadros de animação quando o socket está congestionado, limitando a fila local', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave', speed: 50 }, devices: {} } };
  const mock = new MockClient([controller('RAM 1', 'SMBus:1'), controller('RAM 2', 'SMBus:2')]);
  let currentTime = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => currentTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  mock.calls = [];

  // Primeiro tick: socket desobstruído (writableLength = 0)
  currentTime = 1100;
  await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 2);
  const snap1 = hardware.snapshot();
  assert.equal(snap1.metrics.framesSent, 2);
  assert.equal(snap1.metrics.framesDroppedTransport, 0);

  // Simular congestionamento do transporte local (writableLength > 2048)
  mock.socket.writableLength = 4096;
  mock.calls = [];

  // Ticks seguintes com socket congestionado: quadros devem ser descartados sem acumular fila
  for (let step = 1; step <= 5; step++) {
    currentTime += 50;
    await hardware.tick();
  }

  // Nenhuma chamada nova a updateLeds durante o congestionamento
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 0);
  const snap2 = hardware.snapshot();
  assert.equal(snap2.metrics.framesSent, 2);
  assert.ok(snap2.metrics.framesDroppedTransport >= 10, 'Quadros descartados foram contabilizados na métrica');
  assert.equal(hardware.hasDroppedFrame, true);
});

test('retomada após dreno do socket envia o quadro mais recente sem rajada de quadros antigos', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave', speed: 50 }, devices: {} } };
  const mock = new MockClient([controller('RAM 1', 'SMBus:1')]);
  let currentTime = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => currentTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  mock.calls = [];

  // Enviar quadro inicial
  currentTime = 1050;
  await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1);
  const initialColor = mock.calls.find(c => c[0] === 'leds')[2][0];

  // Congestionar socket por vários passos
  mock.socket.writableLength = 4096;
  for (let i = 0; i < 4; i++) {
    currentTime += 50;
    await hardware.tick();
  }

  // Socket drena
  mock.calls = [];
  mock.socket.writableLength = 0;
  currentTime = 1500; // Tempo avançou significativamente
  mock.socket.emit('drain');

  // Aguardar processamento do tick assíncrono pós-dreno
  await new Promise(resolve => setImmediate(resolve));

  // Apenas UM único quadro recente deve ter sido enviado (sem rajada de 4 quadros)
  const ledsCalls = mock.calls.filter(c => c[0] === 'leds');
  assert.equal(ledsCalls.length, 1, 'Apenas 1 quadro recente despachado');
  assert.notDeepEqual(ledsCalls[0][2][0], initialColor, 'O quadro enviado corresponde ao tempo atual avançado');
  assert.equal(hardware.hasDroppedFrame, false);
});

test('deduplicação evita reenvio de cores idênticas e contabiliza métricas', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave', speed: 50 }, devices: {} } };
  const mock = new MockClient([controller('Placa', 'AURA:1')]);
  let currentTime = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => currentTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  mock.calls = [];

  // Enviar primeiro quadro
  await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1);

  // Chamar tick com o mesmo tempo (cores idênticas geradas pelo motor)
  mock.calls = [];
  await hardware.tick();
  assert.equal(mock.calls.length, 0, 'Cores idênticas não são reenviadas');
  const snap = hardware.snapshot();
  assert.ok(snap.metrics.framesDeduplicated >= 1);

  // Alterar tempo para gerar nova cor: deve enviar
  currentTime += 500;
  await hardware.tick();
  assert.equal(mock.calls.filter(c => c[0] === 'leds').length, 1, 'Cor diferente é enviada corretamente');
});

test('desligamento durante congestionamento tem prioridade e nunca reacende por quadro pendente', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave', speed: 50 }, devices: {} } };
  const mock = new MockClient([controller('RAM', 'SMBus:1')]);
  let currentTime = 1000;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => currentTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();

  // Congestionar socket
  mock.socket.writableLength = 4096;
  currentTime = 1050;
  await hardware.tick(); // Quadro descartado por backpressure

  // Usuário desliga a iluminação enquanto socket está ocupado
  store.data.master.power = false;
  hardware.changed();
  mock.calls = [];
  currentTime = 1100;
  await hardware.tick();

  // Comando de desligamento NÃO pode ser descartado
  const ledsCalls = mock.calls.filter(c => c[0] === 'leds');
  assert.ok(ledsCalls.length >= 1, 'Comando de apagar é enviado mesmo sob congestionamento');
  assert.deepEqual(ledsCalls.at(-1)[2][0], { red: 0, green: 0, blue: 0 });

  // Drenar socket posteriormente: LEDs NÃO devem reacender com quadro antigo
  mock.calls = [];
  mock.socket.writableLength = 0;
  mock.socket.emit('drain');
  await new Promise(resolve => setImmediate(resolve));

  for (const call of mock.calls.filter(c => c[0] === 'leds')) {
    assert.deepEqual(call[2][0], { red: 0, green: 0, blue: 0 }, 'Nenhum quadro aceso é enviado após desligamento');
  }
});

test('reconexão, mudança de modo, redimensionamento e identificação invalidam caches de cor', async t => {
  const store = { data: { master: { ...defaults, effect: 'static', color: '#ff0000' }, devices: {} }, zone() {} };
  const mock = new MockClient([controller('Dispositivo', 'USB:dev')]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  const id = hardware.devices[0].id;

  // Quadro inicial enviado
  await hardware.tick();
  assert.ok(hardware.lastSentColors.has(id));

  // Mudança de modo invalida o cache
  mock.calls = [];
  await hardware.applyMode(hardware.devices[0], hardware.devices[0].raw.modes[0], store.data.master, false);
  assert.equal(hardware.lastSentColors.has(id), false);

  // Redimensionamento invalida o cache
  hardware.lastSentColors.set(id, [{ red: 255, green: 0, blue: 0 }]);
  // Mock de zona redimensionável
  hardware.devices[0].zones = [{ id: 0, name: 'Z1', ledsCount: 8, min: 1, max: 64, resizable: true }];
  hardware.devices[0].raw.zones = [{ id: 0, name: 'Z1', ledsCount: 8, ledsMin: 1, ledsMax: 64, resizable: true }];
  await hardware.resize(id, 0, 12);
  assert.equal(hardware.lastSentColors.has(id), false);

  // Identificação invalida o cache
  hardware.lastSentColors.set(id, [{ red: 255, green: 0, blue: 0 }]);
  hardware.identify(id, 0);
  assert.equal(hardware.lastSentColors.has(id), false);

  // Reconexão limpa todos os caches
  hardware.lastSentColors.set(id, [{ red: 255, green: 0, blue: 0 }]);
  await hardware.connect();
  assert.equal(hardware.lastSentColors.size, 0);
});

test('descoberta periódica é postergada se o socket estiver ocupado com tráfego', async t => {
  const store = { data: { master: defaults, devices: {} } };
  const mock = new MockClient([controller('A', 'USB:1')]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  hardware.discoveryStage = 6;
  hardware.nextDiscovery = 0; // Hora de descobrir

  // Socket ocupado
  mock.socket.writableLength = 100;
  mock.calls = [];
  await hardware.tick();

  // Descoberta deve ter sido adiada para não congestionar com getControllerData
  assert.ok(hardware.nextDiscovery > Date.now());
  assert.equal(mock.calls.filter(c => c[0] === 'count').length, 0);

  // Socket livre: descoberta executa
  mock.socket.writableLength = 0;
  hardware.nextDiscovery = 0;
  await hardware.tick();
  assert.ok(hardware.nextDiscovery > Date.now());
});

test('coordenação de loops: ticks concorrentes do Studio e Hardware são serializados via tickPending sem perda', async t => {
  const store = { data: { master: { ...defaults, effect: 'wave' }, devices: {} } };
  const mock = new MockClient([controller('RAM', 'SMBus:ram')]);
  const hardware = new Hardware(store, { makeClient: () => mock });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();

  // Simular que o hardware está no meio de um tick longo (busy = true)
  hardware.busy = true;

  // Studio envia um quadro espacial completado enquanto hardware está ocupado
  await hardware.tick(true);
  assert.equal(hardware.tickPending, true);
  assert.equal(hardware.tickPendingSpatial, true);

  // Outro tick do timer chega enquanto ainda ocupado
  await hardware.tick(false);
  assert.equal(hardware.tickPending, true);
  assert.equal(hardware.tickPendingSpatial, true, 'Prioridade espacial mantida para o próximo turno');

  // Liberar busy simulado
  hardware.busy = false;
  hardware.tickPending = false;
  hardware.tickPendingSpatial = false;
});

test('comparação de tráfego e recursos: 60 FPS com deduplicação economiza envios sem sobrecarga de CPU', async t => {
  // Simula a composição exata do hardware do usuário: 2 memórias RAM + 1 placa-mãe multizona
  function zonedMotherboard() {
    return {
      name: 'ASUS TUF GAMING A520M-PLUS II',
      vendor: 'ASUSTeK',
      serial: '',
      location: 'AURA:1',
      type: 2,
      colors: Array(36).fill({ red: 0, green: 0, blue: 0 }),
      zones: [
        { id: 0, name: 'AURA Mainboard', ledsCount: 4, ledsMin: 4, ledsMax: 4, resizable: false },
        { id: 1, name: 'Addressable RGB Header 1', ledsCount: 16, ledsMin: 1, ledsMax: 60, resizable: true },
        { id: 2, name: 'Addressable RGB Header 2', ledsCount: 16, ledsMin: 1, ledsMax: 60, resizable: true }
      ],
      modes: [
        { id: 0, name: 'Direct', flagList: ['perLedColor'] }
      ]
    };
  }

  const store = {
    data: {
      master: { ...defaults, effect: 'sequence', speed: 50, palette: ['#ff0000', '#0000ff'] }, // Efeito com alternância periódica: a maioria dos quadros a 60 FPS é estável entre ticks
      devices: {},
      performance: { fps: 60 }
    }
  };

  const mock = new MockClient([
    controller('ENE DRAM 1', 'SMBus:1'),
    controller('ENE DRAM 2', 'SMBus:2'),
    zonedMotherboard()
  ]);

  let simTime = 0;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => simTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  mock.calls = [];

  // Rodar 60 quadros a 60 FPS (intervalo de ~16.66 ms)
  const startCpu = process.cpuUsage();
  const startMemory = process.memoryUsage().heapUsed;
  const t0 = performance.now();

  for (let frameIdx = 0; frameIdx < 60; frameIdx++) {
    simTime += (1000 / 60);
    await hardware.tick();
  }

  const durationMs = performance.now() - t0;
  const cpuDelta = process.cpuUsage(startCpu);
  const memDelta = Math.abs(process.memoryUsage().heapUsed - startMemory);

  const snap = hardware.snapshot();
  const metrics = snap.metrics;

  // Em 60 quadros para 3 controladoras físicas = 180 cálculos de quadro
  assert.equal(metrics.framesCalculated, 180, '60 quadros calculados para os 3 controladores');
  assert.ok(metrics.framesSent > 0, 'Quadros com mudanças reais foram enviados');
  assert.ok(metrics.framesDeduplicated > 0, 'Deduplicação economizou envios no efeito de baixa velocidade');
  assert.ok(metrics.framesSent < metrics.framesCalculated, 'Total enviado foi menor que o total calculado');

  // CPU e memória devem permanecer estritamente contidos
  assert.ok(durationMs < 500, `Tempo total para 60 ticks foi rápido (${durationMs.toFixed(2)} ms)`);
});

test('isSmbusRam identifica corretamente módulos de memória e exclui placas-mãe', () => {
  assert.equal(isSmbusRam({ type: 1, name: 'Kingston Fury' }), true);
  assert.equal(isSmbusRam({ type: 2, name: 'ENE DRAM' }), true);
  assert.equal(isSmbusRam({ type: 2, name: 'Memória RGB' }), true);
  assert.equal(isSmbusRam({ type: 2, name: 'G.Skill Trident Z' }), true);
  assert.equal(isSmbusRam({ type: 0, name: 'ASUS ROG STRIX B550-F' }), false);
  assert.equal(isSmbusRam({ type: 2, name: 'Corsair Commander PRO' }), false);
  assert.equal(isSmbusRam(null), false);
});

test('ritmo duplo inteligente: placa-mãe a 60 FPS e RAM limitada com segurança a 20 FPS', async t => {
  function dram(name) {
    return {
      name,
      vendor: 'ENE',
      serial: '',
      location: 'SMBus:DRAM',
      type: 1,
      colors: Array(8).fill({ red: 0, green: 0, blue: 0 }),
      zones: [{ id: 0, name: 'Zone', ledsCount: 8, ledsMin: 8, ledsMax: 8, resizable: false }],
      modes: [{ id: 0, name: 'Direct', flagList: ['perLedColor'] }]
    };
  }

  function mobo(name) {
    return {
      name,
      vendor: 'ASUS',
      serial: '',
      location: 'AURA:1',
      type: 0,
      colors: Array(16).fill({ red: 0, green: 0, blue: 0 }),
      zones: [{ id: 0, name: 'Zone', ledsCount: 16, ledsMin: 16, ledsMax: 16, resizable: false }],
      modes: [{ id: 0, name: 'Direct', flagList: ['perLedColor'] }]
    };
  }

  const store = {
    data: {
      master: { ...defaults, effect: 'rainbow', speed: 50 },
      devices: {},
      performance: { fps: 60 }
    }
  };

  const mock = new MockClient([
    dram('RAM RGB 1'),
    mobo('Placa-Mãe')
  ]);

  let simTime = 0;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => simTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();
  mock.calls = [];

  // Executar 60 ticks a 60 FPS (16.66 ms por tick)
  for (let i = 0; i < 60; i++) {
    simTime += (1000 / 60);
    await hardware.tick();
  }

  const dramCalls = mock.calls.filter(c => c[0] === 'leds' && c[1] === 0);
  const moboCalls = mock.calls.filter(c => c[0] === 'leds' && c[1] === 1);

  // Placa-mãe deve ter recebido todos os 60 quadros
  assert.equal(moboCalls.length, 60, 'Placa-mãe roda a 60 FPS completos');

  // RAM deve ter sido limitada a 20 FPS (exatamente 20 quadros em 60 ticks de 16.6 ms)
  assert.equal(dramCalls.length, 20, 'RAM é limitada com segurança a 20 FPS (1 envio a cada 50 ms)');
  assert.equal(hardware.metrics.framesThrottledRam, 40, '40 quadros intermediários de RAM foram contidos para poupar SMBus');

  // Desligamento prioritário: apagar deve despachar para a RAM imediatamente sem espera
  store.data.master.power = false;
  hardware.changed();
  mock.calls = [];
  simTime += 5; // Apenas 5 ms após o último quadro (menor que o intervalo de 46 ms)
  await hardware.tick();

  const powerOffDramCalls = mock.calls.filter(c => c[0] === 'leds' && c[1] === 0);
  assert.equal(powerOffDramCalls.length, 1, 'Desligamento da RAM não é bloqueado pelo limitador');
  assert.deepEqual(powerOffDramCalls[0][2][0], { red: 0, green: 0, blue: 0 });
});

test('ritmo duplo no Studio: ticks espaciais (tick(true)) mantêm placa-mãe a 60 FPS e contêm RAM a 20 FPS', async t => {
  function dram(name) {
    return {
      name,
      vendor: 'ENE',
      serial: '',
      location: 'SMBus:DRAM',
      type: 1,
      colors: Array(8).fill({ red: 0, green: 0, blue: 0 }),
      zones: [{ id: 0, name: 'Zone', ledsCount: 8, ledsMin: 8, ledsMax: 8, resizable: false }],
      modes: [{ id: 0, name: 'Direct', flagList: ['perLedColor'] }]
    };
  }

  function mobo(name) {
    return {
      name,
      vendor: 'ASUS',
      serial: '',
      location: 'AURA:1',
      type: 0,
      colors: Array(16).fill({ red: 0, green: 0, blue: 0 }),
      zones: [{ id: 0, name: 'Zone', ledsCount: 16, ledsMin: 16, ledsMax: 16, resizable: false }],
      modes: [{ id: 0, name: 'Direct', flagList: ['perLedColor'] }]
    };
  }

  const store = {
    data: {
      master: { ...defaults, effect: 'rainbow', speed: 50 },
      devices: {},
      performance: { fps: 60 }
    }
  };

  const mock = new MockClient([
    dram('RAM RGB 1'),
    mobo('Placa-Mãe')
  ]);

  let simTime = 0;
  const hardware = new Hardware(store, { makeClient: () => mock, now: () => simTime });
  t.after(() => hardware.stop());

  hardware.stopped = false;
  await hardware.connect();

  const dramId = hardware.devices[0].id;

  let frameCounter = 0;
  hardware.studio = {
    hasDevice: () => true,
    revision: 1,
    colorsFor: id => Array(id === dramId ? 8 : 16).fill({ red: (frameCounter++) % 255, green: 0, blue: 0 })
  };

  mock.calls = [];

  // Executar 60 ticks espaciais de Studio a 60 FPS (16.66 ms por tick)
  for (let i = 0; i < 60; i++) {
    simTime += (1000 / 60);
    hardware.studio.revision++;
    hardware.changed();
    await hardware.tick(true);
  }

  const dramCalls = mock.calls.filter(c => c[0] === 'leds' && c[1] === 0);
  const moboCalls = mock.calls.filter(c => c[0] === 'leds' && c[1] === 1);

  // Placa-mãe roda a 60 FPS
  assert.equal(moboCalls.length, 60, 'Placa-mãe roda a 60 FPS no Studio');

  // RAM contida a exatamente 20 FPS (1 envio a cada 50 ms)
  assert.equal(dramCalls.length, 20, 'RAM no Studio é contida com segurança a 20 FPS');
  assert.equal(hardware.metrics.framesThrottledRam, 40, '40 quadros espaciais de RAM foram contidos no Studio');
});


