const { test, expect } = require('./fixture');
test.use({ serviceWorkers: 'block' });
test('mapa explica modos internos e abre os controles do teclado sem desenhar uma prévia falsa', async ({ page }) => {
  const keyboard = { id: '9'.repeat(24), name: 'RK61', type: 5, kind: 'keyboard', ledCount: 61, spatialCapable: false, status: 'online', effects: ['static', 'wave'], modes: [], zones: [], settings: { power: true, color: '#ff0000', brightness: 80, speed: 40, effect: 'wave' } };
  await page.route('**/api/state', async route => { const body = await (await route.fetch()).json(); body.hardware = { connected: true, devices: [keyboard], controllerCount: 1 }; await route.fulfill({ json: body }); });
  await page.route('**/api/events', route => route.fulfill({ contentType: 'text/event-stream', body: 'retry: 60000\n\n' }));
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-hardware-only')).toBeVisible();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expect(page.locator('#studio-hardware-only')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator('#studio-reset').click();
  await expect(page.locator('.studio-item')).toHaveCount(0);
  await page.locator('#studio-open-devices').click();
  await expect(page.locator('#devices .device-card')).toContainText('RK61');
  await expect(page.locator('#devices .sync-pc-toggle')).toBeVisible();
});
