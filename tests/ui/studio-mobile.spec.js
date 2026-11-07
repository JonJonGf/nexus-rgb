const { test, expect } = require('./fixture');

const devices = [1, 2, 3, 4, 5].map(number => ({
  id: String(number).padStart(24, '0'), name: 'Componente do mapa ' + number,
  type: 0, kind: 'argb', ledCount: 16, status: 'online',
  spatialCapable: true, effects: ['static', 'wave'], modes: [], zones: [],
  settings: { power: true, brightness: 70, effect: 'static', color: '#ff6600', speed: 40 }
}));
devices.push({ ...devices[0], id: '6'.repeat(24), name: 'Teclado com efeitos internos', spatialCapable: false, effects: ['static'], type: 5 });
test.use({ serviceWorkers: 'block', hasTouch: true, hardwareSnapshot: { connected: true, controllerCount: 1, devices } });

test('every phone navigation button is visible and settings opens by touch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await expect(page.locator('#power')).toBeEnabled();
  const navigation = await page.locator('.sidebar .nav').evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect();
    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { page: button.dataset.page, accessible: button.contains(target), height: box.height, x: box.x, y: box.y };
  }));
  expect(navigation.every(button => button.accessible && button.height >= 44), JSON.stringify(navigation)).toBe(true);
  expect(navigation[0].y).toBe(navigation[3].y);
  expect(navigation[4].y).toBeGreaterThan(navigation[0].y);
  expect(navigation[4].x).toBe(navigation[0].x);
  await page.locator('.nav[data-page=settings]').tap();
  await expect(page.locator('#settings-language')).toBeVisible();
});

for (const language of ['pt-BR', 'en']) {
  test('phone map keeps actions, canvas and inspector reachable in ' + language, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');
    await expect(page.locator('#power')).toBeEnabled();
    if (language === 'en') {
      await page.locator('.nav[data-page=settings]').tap();
      await page.locator('#settings-language').selectOption('en');
    }
    const headers = { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' };
    const imported = await page.request.post('/api/studio/import', { headers, data: { source: JSON.stringify({
      format: 'nexus-effect/1', name: 'Arco-íris descendente no setup inteiro',
      pattern: 'wave', palette: ['#ff0000', '#00ff00', '#0000ff'], speed: 30, angle: 90, scale: 1
    }) } });
    expect(imported.ok()).toBe(true);
    const { id } = await imported.json();
    expect((await page.request.post('/api/studio', { headers, data: { activeId: id, enabled: true } })).ok()).toBe(true);
    const snapshot = await (await page.request.get('/api/studio')).json();
    const frame = { layout: snapshot.layout, enabled: true, power: true, connected: true, output: [] };
    await page.route('**/api/studio/preview', route => route.fulfill({ contentType: 'text/event-stream', body: 'retry: 50000\ndata: ' + JSON.stringify(frame) + '\n\n' }));
    await page.locator('.nav[data-page=studio]').tap();
    await expect(page.locator('.studio-item')).toHaveCount(5);
    await expect(page.locator('#studio-current-effect')).toHaveText('Arco-íris descendente no setup inteiro');
    for (const size of [{ width: 390, height: 740 }, { width: 360, height: 530 }, { width: 740, height: 390 }]) {
      await page.setViewportSize(size);
      await page.locator('#studio-choose').scrollIntoViewIfNeeded();
      const button = await page.locator('#studio-choose').boundingBox();
      const stage = await page.locator('.studio-stage').boundingBox();
      const column = await page.locator('.studio-stage-column').boundingBox();
      expect(stage.y).toBeGreaterThanOrEqual(column.y);
      expect(stage.y).toBeGreaterThanOrEqual(button.y + button.height);
      await page.locator('#studio-choose').tap();
      await expect(page.locator('#studio-picker-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.locator('#studio-device-chips button').first().scrollIntoViewIfNeeded();
      await page.locator('#studio-device-chips button').first().tap();
      await page.locator('.studio-inspector-tabs').scrollIntoViewIfNeeded();
      const tabs = await page.locator('.studio-inspector-tabs').boundingBox();
      const chips = await page.locator('#studio-device-chips').boundingBox();
      expect(tabs.y).toBeGreaterThanOrEqual(chips.y + chips.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#studio-tab-effect').tap();
      await expect(page.locator('#studio-effect-panel')).toBeVisible();
      await page.locator('#studio-tab-device').tap();
      if (size.width === 390) {
        await page.locator('.studio-toolbar').scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'test-results/stable-map-' + language + '.png' });
      }
    }
  });
}
