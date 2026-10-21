'use strict';
const { test, expect } = require('./fixture');
test.use({ serviceWorkers: 'block' });
const settings = { power: true, color: '#ff0000', brightness: 50, speed: 40, effect: 'static' };
let serial = 0;
function appliance(name, type, sizes) {
  const controllerId = (++serial).toString(16).padStart(24, '0');
  return sizes.map((leds, index) => ({
    id: index ? (++serial).toString(16).padStart(24, '0') : controllerId,
    controllerId, controllerName: name, name: index ? `Zona ${index + 1}` : name, vendor: 'Fixture', type,
    ledCount: leds, status: 'online', splitZone: true, settings, effects: ['static', 'wave'], modes: [],
    zones: [{ id: index, name: `Saída ${index + 1}`, leds, min: 0, max: 256, resizable: type === 0 }]
  }));
}
const devices = [...appliance('GPU de teste', 2, [1,1,1,1,1]), ...appliance('Placa-mãe de teste', 0, [16,16,1,1,1]), ...appliance('Mouse de teste', 6, [1,1])];
test.use({ hardwareSnapshot: { connected: true, controllerCount: 3, devices } });

test('doze zonas aparecem em três aparelhos com ajustes individuais acessíveis', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.locator('.nav[data-page=devices]').click();
  await expect(page.locator('#devices > .device-card')).toHaveCount(3);
  await expect(page.locator('#device-count')).toHaveText('3');
  await expect(page.locator('#filter-all-count')).toHaveText('3');
  await expect(page.locator('#filter-internal-count')).toHaveText('2');
  await expect(page.locator('#filter-peripherals-count')).toHaveText('1');
  const gpu = page.locator('#devices > .device-card').filter({ has: page.getByRole('heading', { name: 'GPU de teste', exact: true }) });
  await expect(gpu).toHaveCount(1);
  await expect(gpu.getByText('5 zonas · 5 LEDs', { exact: true })).toBeVisible();
  await gpu.getByText('Zonas e controles individuais', { exact: true }).click();
  await expect(gpu.locator('.device-zone')).toHaveCount(5);
  const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/devices/' + devices[1].id));
  await gpu.getByLabel('Cor de Zona 2', { exact: true }).fill('#00ff00');
  await gpu.getByLabel('Cor de Zona 2', { exact: true }).dispatchEvent('change');
  expect((await request).postDataJSON()).toEqual({ color: '#00ff00', effect: 'static' });
  await page.screenshot({ path: 'data/alpha40-devices-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(gpu.getByLabel('Cor de Zona 2', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'data/alpha40-devices-mobile.png' });
  await page.getByRole('button', { name: /Periféricos/ }).click();
  await expect(page.locator('#devices > .device-card')).toHaveCount(1);
  await expect(page.locator('#devices > .device-card').getByRole('heading', { name: 'Mouse de teste', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('agrupamento mantém nomes de aparelhos e traduz controles e contagens em inglês', async ({ page }) => {
  await page.goto('/'); await page.locator('.nav[data-page=settings]').click();
  await page.locator('#settings-language').selectOption('en'); await page.locator('.nav[data-page=devices]').click();
  await expect(page.locator('#devices > .device-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'GPU de teste', exact: true })).toBeVisible();
  await expect(page.getByText('5 zones · 5 LEDs', { exact: true })).toBeVisible();
  await page.getByText('Zones and individual controls', { exact: true }).first().click();
  await expect(page.getByLabel('Color of Zona 2', { exact: true }).first()).toBeVisible();
});

test.describe('saída ARGB não configurada', () => {
  const ports = appliance('Controladora com ARGB', 0, [0, 12]);
  test.use({ hardwareSnapshot: { connected: true, controllerCount: 1, devices: ports } });
  test('explica os zero LEDs e permite configurar somente a saída escolhida', async ({ page }) => {
    await page.goto('/'); await page.locator('.nav[data-page=devices]').click();
    await page.getByText('Zonas e controles individuais', { exact: true }).click();
    await expect(page.getByText('Esta saída está com zero LEDs. Configure a quantidade conectada para controlar sua iluminação.', { exact: true })).toBeVisible();
    const count = page.getByLabel('LEDs em Saída 1', { exact: true });
    await expect(count).toBeVisible(); await expect(count).toHaveValue('0');
    await count.fill('24');
    const request = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/devices/' + ports[0].id + '/resize'));
    await page.locator('.device-zone').first().getByRole('button', { name: 'Aplicar quantidade', exact: true }).click();
    expect((await request).postDataJSON()).toEqual({ zone: 0, count: 24 });
  });
});
