'use strict';
const { test, expect } = require('./fixture');
test.use({ serviceWorkers: 'block' });

test('dispositivos filtram periféricos e exibem sincronização com o PC para teclado', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const devices = [
    {
      id: '000000000000000000000001',
      name: 'Ventoinha Gabinete',
      vendor: 'Nexus',
      type: 3, // Fan
      kind: 'fan',
      ledCount: 12,
      status: 'online',
      settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'wave' },
      effects: ['static', 'wave', 'breathe', 'pulse'],
      modes: [],
      zones: []
    },
    {
      id: '000000000000000000000002',
      name: 'Royal Kludge RK61',
      vendor: 'Royal Kludge',
      type: 5, // Keyboard
      kind: 'keyboard',
      ledCount: 61,
      shape: 'matrix',
      columns: 14,
      status: 'online',
      settings: { power: true, color: '#00f0ff', brightness: 100, speed: 50, effect: 'wave', syncWithPc: true },
      effects: ['static', 'wave', 'rainbow', 'breathe', 'pulse', 'scanner', 'strobe', 'sequence'],
      modes: [
        { id: 0x01, name: 'Onda / Arco-íris (Wave)' },
        { id: 0x12, name: 'Respiração (Breathe)' },
        { id: 0x11, name: 'Estático (Cor fixa)' }
      ],
      zones: [{ id: 0, name: 'Teclas (60% ANSI)', leds: 61, min: 61, max: 61, resizable: false }]
    }
  ];

  const mockState = {
    version: '0.1.0',
    master: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'wave' },
    profiles: [],
    presets: [],
    alexa: { enabled: false, status: 'Desativada' },
    hardware: { connected: true, controllerCount: 2, error: null, devices }
  };

  await page.route('**/api/state', route => route.fulfill({ json: mockState }));
  await page.route('**/api/events', route => route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: `retry: 60000\ndata: ${JSON.stringify(mockState)}\n\n` }));


  await page.goto('/');
  await expect(page.locator('#power')).toBeEnabled();

  // Navigate to Devices page
  await page.locator('.nav[data-page=devices]').click();

  // Verify filter bar exists and counts are correct
  const filterAll = page.locator('[data-device-filter=all]');
  const filterInternal = page.locator('[data-device-filter=internal]');
  const filterPeripherals = page.locator('[data-device-filter=peripherals]');

  await expect(filterAll).toBeVisible();
  await expect(filterInternal).toBeVisible();
  await expect(filterPeripherals).toBeVisible();

  await expect(page.locator('#filter-all-count')).toHaveText('2');
  await expect(page.locator('#filter-internal-count')).toHaveText('1');
  await expect(page.locator('#filter-peripherals-count')).toHaveText('1');

  // Both devices visible initially
  await expect(page.locator('#devices .device-card')).toHaveCount(2);

  // Filter to Peripherals only
  await filterPeripherals.click();
  await expect(page.locator('#devices .device-card')).toHaveCount(1);
  await expect(page.locator('#devices .device-card')).toContainText('Royal Kludge RK61');
  await expect(page.locator('#devices .device-card')).toContainText('TECLADO');
  await expect(page.locator('#devices .device-card')).toContainText('61 LEDs');

  // Verify sync checkbox exists and is checked
  const syncToggle = page.locator('#devices .sync-pc-toggle input[type=checkbox]');
  await expect(syncToggle).toBeVisible();
  await expect(syncToggle).toBeChecked();
  await expect(page.locator('#devices .sync-label')).toHaveText('Segue o controle geral');

  // Click checkbox to uncheck "Sincronizar com o PC"
  const patchPromise = page.waitForRequest(req =>
    req.url().includes('/api/devices/000000000000000000000002') &&
    req.method() === 'POST' &&
    req.postDataJSON()?.syncWithPc === false
  );
  await syncToggle.click();
  await patchPromise;

  // Filter to Internal only
  await filterInternal.click();
  await expect(page.locator('#devices .device-card')).toHaveCount(1);
  await expect(page.locator('#devices .device-card')).toContainText('Ventoinha Gabinete');
  await expect(page.locator('#devices .sync-pc-toggle')).toHaveCount(0); // Fan does not have sync-pc-toggle

  expect(errors).toEqual([]);
});
