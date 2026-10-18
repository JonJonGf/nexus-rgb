'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectBusArchitecture, classifyDeviceType, Hardware } = require('../server/hardware');
const spatial = require('../public/spatial');
const { diagnostics } = require('../server/diagnostics');

test('detectBusArchitecture: classifica corretamente os barramentos Intel, AMD, SuperIO e USB/HID', () => {
  // 1. Intel PCH SMBus (i801)
  assert.equal(detectBusArchitecture({ location: 'SMBus: Intel i801 adapter at 0xF000, Address 0x77' }), 'intel-smbus');
  assert.equal(detectBusArchitecture({ location: 'I2C: Intel(R) 100/C230 Series Chipset Family SMBus' }), 'intel-smbus');

  // 2. AMD Chipset SMBus (PIIX4)
  assert.equal(detectBusArchitecture({ location: 'SMBus: AMD PIIX4 adapter at 0x0B00, Address 0x77' }), 'amd-smbus');
  assert.equal(detectBusArchitecture({ location: 'SMBus: AMD SB800 adapter at 0x0B00' }), 'amd-smbus');

  // 3. SuperIO (Nuvoton / LPC)
  assert.equal(detectBusArchitecture({ location: 'SMBus: Nuvoton NCT6793D SMBus at 0x0290' }), 'superio');
  assert.equal(detectBusArchitecture({ location: 'LPC: ITE IT8686E' }), 'superio');

  // 4. USB / HID
  assert.equal(detectBusArchitecture({ location: 'USB: 046d:c08b, Location: 1-4' }), 'usb-hid');
  assert.equal(detectBusArchitecture({ location: 'HID: \\\\?\\hid#vid_0c70&pid_f001' }), 'usb-hid');
  assert.equal(detectBusArchitecture({ location: 'hidapi: Corsair Commander Core' }), 'usb-hid');

  // 5. Genérico / Desconhecido
  assert.equal(detectBusArchitecture({ location: 'I2C: /dev/i2c-1, Address 0x58' }), 'generic-smbus');
  assert.equal(detectBusArchitecture({ location: '' }), 'unknown');
  assert.equal(detectBusArchitecture(null), 'unknown');
});

test('classifyDeviceType: identifica e categoriza periféricos e componentes do ecossistema', () => {
  // Teclados (tipo 5)
  assert.equal(classifyDeviceType({ type: 5, name: 'Corsair K70 RGB' }), 5);
  assert.equal(classifyDeviceType({ name: 'Razer Huntsman Mini Teclado' }), 5);
  assert.equal(classifyDeviceType({ name: 'SteelSeries Apex Pro Keyboard' }), 5);

  // Mouses e Mousepads (tipos 6 e 7)
  assert.equal(classifyDeviceType({ type: 6, name: 'Logitech G502 HERO' }), 6);
  assert.equal(classifyDeviceType({ name: 'Razer DeathAdder V3 Mouse' }), 6);
  assert.equal(classifyDeviceType({ type: 7, name: 'Corsair MM800 Polaris' }), 7);
  assert.equal(classifyDeviceType({ name: 'Razer Goliathus Chroma Mousepad' }), 7);

  // Placas de Vídeo (tipo 2)
  assert.equal(classifyDeviceType({ type: 2, name: 'ASUS TUF RTX 4080' }), 2);
  assert.equal(classifyDeviceType({ name: 'Gigabyte GeForce RTX 4070 Ti' }), 2);
  assert.equal(classifyDeviceType({ name: 'MSI Radeon RX 7900 XTX GPU' }), 2);

  // Coolers / Fans (tipo 3)
  assert.equal(classifyDeviceType({ type: 3, name: 'AMD Wraith Prism' }), 3);
  assert.equal(classifyDeviceType({ name: 'NZXT Kraken X63 AIO' }), 3);
  assert.equal(classifyDeviceType({ name: 'Lian Li Uni Fan SL120' }), 3);
  assert.equal(classifyDeviceType({ name: 'Corsair Hydro H100i Cooler' }), 3);

  // Fitas LED (tipo 4)
  assert.equal(classifyDeviceType({ type: 4, name: 'Fita LED Gabinete' }), 4);
  assert.equal(classifyDeviceType({ name: 'Corsair RGB LED Strip' }), 4);

  // RAM e Placa-Mãe (tipos 1 e 0)
  assert.equal(classifyDeviceType({ type: 1, name: 'G.Skill Trident Z Neo' }), 1);
  assert.equal(classifyDeviceType({ name: 'Kingston Fury Beast RGB DRAM' }), 1);
  assert.equal(classifyDeviceType({ type: 0, name: 'ASUS ROG STRIX X670E-E' }), 0);
});

test('spatial.defaults: aplica proporções e formatos inteligentes para periféricos', () => {
  const devices = [
    { id: '1'.repeat(24), name: 'Teclado Mecânico', type: 5, ledCount: 104, kind: 'device' },
    { id: '2'.repeat(24), name: 'Mouse Gamer', type: 6, ledCount: 8, kind: 'device' },
    { id: '3'.repeat(24), name: 'Water Cooler AIO', type: 3, ledCount: 16, kind: 'device' },
    { id: '4'.repeat(24), name: 'Memória RAM', type: 1, ledCount: 8, kind: 'device' }
  ];

  const layout = spatial.defaults(devices);
  assert.equal(layout.length, 4);

  const keyboard = layout.find(item => item.deviceId === '1'.repeat(24));
  const mouse = layout.find(item => item.deviceId === '2'.repeat(24));
  const cooler = layout.find(item => item.deviceId === '3'.repeat(24));
  const ram = layout.find(item => item.deviceId === '4'.repeat(24));

  // Teclado deve ter largura horizontal maior que altura (proporção retangular ampla)
  assert.ok(keyboard.width > keyboard.height, 'Teclado deve ser horizontal');
  // Cooler deve ter formato 'fan'
  assert.equal(cooler.shape, 'fan', 'Cooler deve ser gerado como fan/anel circular');
  // RAM deve ter formato vertical fino
  assert.ok(ram.height > ram.width, 'RAM deve ser vertical');
});

test('diagnostics: reporta busTypes agrupados com anonimização estrita', () => {
  const mockHardware = {
    snapshot: () => ({
      connected: true,
      controllerCount: 3,
      controllerHung: false,
      error: null,
      busTypes: ['intel-smbus', 'usb-hid'],
      devices: [
        { id: 'dev1', name: 'Corsair Vengeance', type: 1, ledCount: 8, kind: 'device', busType: 'intel-smbus' },
        { id: 'dev2', name: 'Razer Huntsman', type: 5, ledCount: 104, kind: 'device', busType: 'usb-hid' }
      ]
    })
  };

  const report = diagnostics(mockHardware, { config: {} }, { data: {} }, null);
  assert.ok(Array.isArray(report.health.busTypes));
  assert.deepEqual(report.health.busTypes, ['intel-smbus', 'usb-hid']);
  // Privacidade garantida: nenhuma localização crua ou ID interno é exposto
  const str = JSON.stringify(report);
  assert.ok(!str.includes('location'));
  assert.ok(!str.includes('0xF000'));
});
