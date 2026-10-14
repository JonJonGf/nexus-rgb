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

test('arrastar a bolinha move a cor sem selecionar a página, inclusive fora da roda', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.getByRole('button', { name: 'Usar cor #00ff88', exact: true }).click();
  await expect(page.locator('#hex')).toHaveValue('#00FF88');
  const writes = []; page.on('request', request => { if (request.url().endsWith('/api/control')) writes.push(request.postDataJSON()); });
  await page.evaluate(() => {
    const selection = getSelection(), range = document.createRange(); range.selectNodeContents(document.querySelector('#page-title')); selection.removeAllRanges(); selection.addRange(range);
    window.nativeDrags = 0; document.addEventListener('dragstart', () => window.nativeDrags++);
  });
  const canvas = await page.locator('#color-wheel').boundingBox(), cursor = await page.locator('#wheel-cursor').boundingBox();
  await page.mouse.move(cursor.x + cursor.width / 2, cursor.y + cursor.height / 2); await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height * .92, { steps: 8 });
  const preview = await page.locator('#hex').inputValue(); expect(preview).not.toBe('#00FF88');
  expect(await page.evaluate(() => getSelection().toString())).toBe(''); expect(writes).toEqual([]);
  await page.mouse.move(canvas.x + canvas.width + 40, canvas.y + canvas.height / 2, { steps: 8 });
  await expect(page.locator('#hex')).toHaveValue('#FF0000'); await page.mouse.up();
  await expect.poll(() => writes.length).toBe(1); expect(writes[0]).toEqual({ color: '#ff0000', effect: 'static' });
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).master.color).toBe('#ff0000');
  expect(await page.evaluate(() => ({ selection: getSelection().toString(), drags: window.nativeDrags }))).toEqual({ selection: '', drags: 0 });
  await page.screenshot({ path: 'test-results/roda-arraste-desktop.png' });
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height * .1); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await page.keyboard.press('Escape');
  expect(writes.length).toBe(1); await expect(page.locator('#hex')).toHaveValue('#FF0000'); expect(errors).toEqual([]);
});

test('sessão do PC expirada é refeita e controle recusado com 401 é enviado uma única vez após autenticar', async ({ page }) => {
  let bootstraps = 0, refused = false, successfulWrites = 0;
  page.on('request', request => { if (request.url().endsWith('/api/session/local')) bootstraps++; });
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  expect(bootstraps).toBe(1);
  await page.route('**/api/control', async route => {
    if (!refused) { refused = true; return route.fulfill({ status: 401, json: { error: 'Sessão do processo anterior.' } }); }
    successfulWrites++; return route.continue();
  });
  await page.getByRole('button', { name: 'Usar cor #bd00ff', exact: true }).click();
  await expect(page.locator('#hex')).toHaveValue('#BD00FF');
  expect(bootstraps).toBe(2); expect(successfulWrites).toBe(1);
});

test('queda do stream e nova sessão do serviço recuperam o painel sem recarregar', async ({ page }) => {
  let bootstraps = 0, streamRequests = 0;
  page.on('request', request => { if (request.url().endsWith('/api/session/local')) bootstraps++; });
  await page.route('**/api/events', route => {
    streamRequests++;
    // Simulate a service exiting and invalidating its in-memory session.
    if (streamRequests <= 2) return route.fulfill({ status: 401, json: { error: 'Serviço reiniciado.' } });
    return route.continue();
  });
  await page.goto('/');
  await expect.poll(() => streamRequests, { timeout: 15000 }).toBeGreaterThanOrEqual(3);
  await expect(page.locator('#power')).toBeEnabled();
  expect(bootstraps).toBe(3);
  await page.getByRole('button', { name: 'Usar cor #ff8000', exact: true }).click();
  await expect(page.locator('#hex')).toHaveValue('#FF8000');
});

test('cliente LAN com resposta 401 nunca solicita uma sessão administrativa', async ({ page }) => {
  const adapters = require('../../server/network').adapters();
  test.skip(!adapters.length, 'Este ambiente não tem adaptador privado para testar a LAN real.');
  let bootstraps = 0;
  page.on('request', request => { if (request.url().endsWith('/api/session/local')) bootstraps++; });
  await page.goto(`http://${adapters[0].address}:5071/`);
  await expect(page.locator('#power')).toBeEnabled();
  await page.route('**/api/control', route => route.fulfill({ status: 401, json: { error: 'Sessão LAN recusada.' } }));
  await page.getByRole('button', { name: 'Usar cor #ff0055', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Sessão LAN recusada.');
  expect(bootstraps).toBe(0);
});
