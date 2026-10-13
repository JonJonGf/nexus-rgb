'use strict';
const { test, expect } = require('@playwright/test');
// Network mocks must reach the page rather than a local service-worker fetch.
test.use({ serviceWorkers: 'block' });
test('controle local, perfis seguros e link permanente sem fluxo de pareamento', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await expect(page.locator('#notice')).toContainText('não está conectado');
  await page.locator('#power').uncheck(); await expect(page.locator('#preview-effect')).toHaveText('Luzes apagadas');
  await page.getByRole('button', { name: 'Usar cor #ff0055', exact: true }).click(); await expect(page.locator('#preview-hex')).toHaveText('#FF0055');
  await page.locator('.nav[data-page=profiles]').click(); await page.locator('#save-profile').click(); await page.locator('#profile-name').fill('<img src=x onerror=alert(1)>'); await page.locator('#profile-form').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('#profiles')).toContainText('<img src=x onerror=alert(1)>'); await expect(page.locator('#profiles img')).toHaveCount(0);
  await page.locator('.nav[data-page=connect]').click(); await expect(page.locator('#admin-connections')).toBeVisible(); await expect(page.getByText('Sem login · Sem expiração · Sem pareamento')).toBeHidden();
  if (await page.locator('#network-select option').count()) {
    await page.locator('#generate-qr').click(); await expect(page.locator('#qr-box')).toBeVisible(); const link = await page.locator('#pair-link').getAttribute('href');
    await page.locator('#generate-qr').click(); await expect(page.locator('#pair-link')).toHaveAttribute('href', link); expect(new URL(link).hash).toBe('');
  }
  await page.screenshot({ path: 'test-results/conexoes-desktop.png', fullPage: true }); expect(errors).toEqual([]);
});
test('layout móvel não excede a tela e não pede login/QR', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.nav[data-page=devices]').click(); await expect(page.locator('#devices')).toContainText('Nenhum dispositivo detectado');
  await page.locator('.nav[data-page=control]').click(); await page.screenshot({ path: 'test-results/painel-mobile.png', fullPage: true });
  expect(await page.getByRole('button', { name: /Parear|Login|Entrar/ }).count()).toBe(0);
});

test('console cabe na tela, muda a identidade pela cor e oferece cenas reais', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message)); await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  const before = await page.locator('.nav.active').evaluate(element => getComputedStyle(element).color);
  await page.getByRole('button', { name: 'Usar cor #00ff88', exact: true }).click(); await expect(page.locator('#hex')).toHaveValue('#00FF88');
  expect(await page.locator('.nav.active').evaluate(element => getComputedStyle(element).color)).not.toBe(before);
  for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080], [390, 844], [375, 667]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100);
    const bottom = height - (width <= 800 ? 59 : 0);
    for (const selector of ['#hardware-mini', '#color-wheel', '#effects', '#brightness', '#speed', '#quick-presets']) {
      const box = await page.locator(selector).boundingBox(); expect(box, selector).not.toBeNull(); expect(box.y, selector).toBeGreaterThanOrEqual(0); expect(box.y + box.height, `${selector} ${width}x${height}`).toBeLessThanOrEqual(bottom); expect(box.x + box.width, selector).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: `test-results/console-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 }); await page.locator('.nav[data-page=profiles]').click(); await expect(page.locator('#preset-gallery .profile-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Ativar Aurora', exact: true }).click(); await page.locator('.nav[data-page=control]').click(); await expect(page.locator('#preview-effect')).toHaveText('Onda'); await expect(page.locator('#brightness-label')).toHaveText('65%');
  const response = await page.request.get('/api/state'); const state = await response.json(); expect(state.master.palette).toEqual(['#00ff99', '#00c8ff', '#8156ff']); expect(errors).toEqual([]);
});

test('cinco componentes com portas ARGB cabem no console desktop e móvel', async ({ page }) => {
  const mock = { version: '0.1.0', master: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, profiles: [], presets: [], alexa: { enabled: false, status: 'Desativada' }, hardware: { connected: true, controllerCount: 3, error: null, devices: [0, 1, 2, 3, 4].map(index => ({ id: String(index).padStart(24, '0'), name: index === 2 ? 'Placa-mãe com nome longo' : index > 2 ? `ARGB ${index - 2}` : 'Memória RGB', vendor: 'Teste', type: index < 2 ? 1 : 0, kind: index > 2 ? 'argb' : 'device', ledCount: index > 2 ? 60 : 8, status: 'online', settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static'], modes: [], zones: [] })) } };
  await page.route('**/api/state', route => route.fulfill({ json: mock }));
  await page.route('**/api/events', route => route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: `retry: 60000\ndata: ${JSON.stringify(mock)}\n\n` }));
  for (const [width, height] of [[1280, 720], [1366, 768], [390, 844], [375, 667]]) {
    await page.setViewportSize({ width, height }); await page.goto('/'); await expect(page.locator('#hardware-mini .mini')).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const canvas = await page.locator('#color-wheel').boundingBox(), readout = await page.locator('.color-readout').boundingBox(), effects = await page.locator('#effects').boundingBox(), intensity = await page.locator('.intensity-controls').boundingBox();
    if(width <= 800) expect(canvas.x + canvas.width).toBeLessThanOrEqual(readout.x);
    expect(effects.y + effects.height).toBeLessThanOrEqual(intensity.y); expect(intensity.y + intensity.height).toBeLessThanOrEqual(height - (width <= 800 ? 59 : 0));
    const presets = await page.locator('#quick-presets').boundingBox(); expect(presets.y + presets.height).toBeLessThanOrEqual(height - (width <= 800 ? 59 : 0));
  }
});
