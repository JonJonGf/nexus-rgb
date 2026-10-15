const { test, expect } = require('@playwright/test');
test.use({ serviceWorkers: 'block' });
test('mapa permite arrastar, dividir, salvar e importar uma fórmula sem executar HTML no navegador', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const devices = [0, 1, 2].map(i => ({ id: String(i + 1).padStart(24, '0'), name: i === 2 ? 'ARGB de teste' : 'RAM ' + (i + 1), vendor: 'Teste', type: i < 2 ? 1 : 0, kind: i === 2 ? 'argb' : 'device', ledCount: i === 2 ? 24 : 8, status: 'online', settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static', 'wave'], modes: [], zones: [] }));
  await page.route('**/api/state', async route => { const response = await route.fetch(); const body = await response.json(); body.hardware = { connected: true, controllerCount: 3, devices }; await route.fulfill({ json: body }); });
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-effect option')).not.toHaveCount(0);
  // Use the same default layout helper as the product, with virtual fixture devices.
  const layout = await page.evaluate(ds => NexusSpatial.defaults(ds), devices);
  await page.request.post('/api/studio', { headers: { Origin: 'http://127.0.0.1:5071', 'X-Nexus-Client': 'web' }, data: { layout } });
  await page.locator('.nav[data-page=control]').click(); await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('.studio-item')).toHaveCount(3);
  const target = page.locator('.studio-item').last(); const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 75, box.y + box.height / 2 + 30, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('#studio-dirty')).toHaveText('Alterações não salvas');
  await expect(page.locator('#studio-live-note')).toContainText('posições salvas');
  await page.locator('#studio-split').click(); await expect(page.locator('.studio-item')).toHaveCount(4);
  await page.locator('#studio-save').click(); await expect(page.locator('#studio-dirty')).toHaveText('Mapa salvo');
  await expect(page.locator('#studio-preview')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(page.locator('#studio-leds')).toBeVisible();
  const savedMap = await (await page.request.get('/api/studio')).json();
  const image = (await page.locator('#studio-preview').getAttribute('src')).split(',')[1];
  const packet = { image, layout: savedMap.layout, enabled: true, power: true, connected: true, output: devices.map(d => ({ id: d.id, source: 'map', rgb: Buffer.from(Array.from({ length: d.ledCount }, (_, n) => d.ledCount === 24 && n >= 12 ? [0, 255, 0] : [255, 0, 0]).flat()).toString('base64') })) };
  await page.route('**/api/studio/preview', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 50000\ndata: ' + JSON.stringify(packet) + '\n\n' }));
  await page.locator('.nav[data-page=control]').click(); await page.locator('.nav[data-page=studio]').click();
  await expect.poll(() => page.evaluate(layout => {
    const ctx = document.getElementById('studio-leds').getContext('2d'), entry = layout.find(i => i.start >= 12), point = NexusSpatial.points(entry)[0];
    return Array.from(ctx.getImageData(Math.round(point.x * 3), Math.round(point.y * 3), 1, 1).data).slice(0, 3);
  }, packet.layout)).toEqual([0, 255, 0]);
  await page.locator('#studio-new').click(); const recipe = { format: 'nexus-effect/1', name: 'Minha onda no mapa', pattern: 'wave', palette: ['#ff0055', '#00f0ff'], speed: 20, angle: 45, scale: 1 };
  await page.locator('#studio-source').fill(JSON.stringify(recipe)); await page.locator('#studio-formula-form').getByRole('button', { name: 'Salvar fórmula na biblioteca' }).click();
  await expect(page.locator('#studio-effect')).toContainText('Minha onda no mapa'); await page.locator('#studio-formula-close').click();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/mapa-' + width + '.png', fullPage: true });
  }
  await page.reload(); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=studio]').click(); await expect(page.locator('.studio-item')).toHaveCount(4);
  expect(errors).toEqual([]);
});
test('configurações permitem escolher e persistir FPS sem reiniciar o servidor', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=settings]').click();
  await page.locator('[data-fps="60"]').click(); await expect(page.locator('#settings-fps-label')).toHaveText('60 FPS');
  await page.locator('#settings-fps-save').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).performance.fps).toBe(60);
  await page.reload(); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=settings]').click(); await expect(page.locator('#settings-fps')).toHaveValue('60');
  await page.locator('[data-fps="20"]').click(); await page.locator('#settings-fps-save').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).performance.fps).toBe(20);
});
