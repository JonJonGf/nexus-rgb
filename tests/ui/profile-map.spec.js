'use strict';
const { test, expect } = require('./fixture');
test.use({ serviceWorkers: 'block' });

test('perfil novo pode escolher efeito do mapa e título curto persiste em inglês', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled(); await expect(page).toHaveTitle('Nexus RGB');
  const before = await (await page.request.get('/api/state')).json();
  await page.locator('.nav[data-page=profiles]').click(); await page.locator('#create-profile').click();
  await page.locator('#profile-name').fill('Novo mapa'); await page.locator('#profile-mode').selectOption('map');
  await page.locator('#profile-map-angle').fill('75');
  await page.locator('.nav[data-page=settings]').click(); await page.locator('#settings-language').selectOption('en');
  await expect(page).toHaveTitle('Nexus RGB');
  await page.locator('.nav[data-page=profiles]').click(); await expect(page.locator('#profile-map-angle')).toHaveValue('75');
  await expect(page.locator('#profile-mode option[value=map]')).toHaveText('Map effect');
  await expect(page.locator('#profile-map-note')).toContainText('Saving keeps the current lights unchanged.');
  await page.locator('#profile-submit').click(); await expect(page.locator('#profile-form')).toBeHidden();
  const saved = await (await page.request.get('/api/state')).json();
  expect(saved.profiles[0].spatial).toBe(true); expect(saved.master).toEqual(before.master); expect(saved.studio).toEqual(before.studio);
});

const sourceHTML = '<head><title>Canvas salvo</title><meta property="ink" label="Cor" type="color" default="#1234ab"></head><canvas id="c" width="40" height="40"></canvas><script>var ctx=document.getElementById("c").getContext("2d");ctx.fillStyle=ink;ctx.fillRect(0,0,40,40);</script>';
for (const format of ['json', 'html']) test(`perfil permite editar o código ${format} sem substituir outros perfis ou ativar as luzes`, async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  const headers = { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' };
  const source = format === 'html' ? sourceHTML : JSON.stringify({ format: 'nexus-effect/1', name: 'JSON salvo', pattern: 'wave', palette: ['#1234ab'], speed: 15, angle: 30, scale: 1 });
  const imported = await (await page.request.post('/api/studio/import', { headers, data: { source } })).json();
  await page.request.post('/api/studio/profiles', { headers, data: { name: 'Perfil código', activeId: imported.id, values: format === 'html' ? { ink: '#abcdef' } : {} } });
  const before = await (await page.request.get('/api/state')).json(), profile = before.profiles[0];
  await page.request.post(`/api/profiles/${profile.id}/duplicate`, { headers, data: { name: 'Cópia preservada' } });
  await page.locator('.nav[data-page=profiles]').click();
  const card = page.locator('#profiles .profile-card').filter({ has: page.getByRole('heading', { name: 'Perfil código', exact: true }) });
  await card.getByRole('button', { name: 'Editar código', exact: true }).click();
  await expect(page.locator('#studio-formula-dialog')).toBeVisible();
  if (format === 'json') await page.locator('#formula-advanced summary').click();
  await expect(page.locator('#studio-source')).toHaveValue(source);
  const revised = source.replace('#1234ab', '#ffaa00');
  await page.locator('#studio-source').fill(revised);
  if (format === 'html') {
    await page.locator('#formula-preview-toggle').click();
    await expect(page.locator('#formula-preview-toggle')).toHaveText('Pausar prévia');
    await expect(page.locator('#formula-code-parameters input')).toHaveValue('#abcdef');
    await page.locator('#formula-preview-toggle').click();
  }
  await page.locator('#formula-save').click();
  await expect(page.locator('#studio-formula-dialog')).not.toBeVisible();
  const after = await (await page.request.get('/api/state')).json();
  expect(after.master).toEqual(before.master); expect(after.studio).toEqual(before.studio);
  expect(after.profiles).toHaveLength(2);
  const saved = after.profiles.find(p => p.id === profile.id);
  expect(saved.spatial).toBe(true); expect(saved.studio.activeId).not.toBe(imported.id);
  expect(after.profiles.find(p => p.name === 'Cópia preservada').studio.activeId).toBe(imported.id);
  if (format === 'html') expect((await (await page.request.get(`/api/profiles/${profile.id}/effect`)).json()).values).toEqual({ ink: '#abcdef' });
  await card.getByRole('button', { name: 'Editar código', exact: true }).click();
  await expect(page.locator('#studio-source')).toHaveValue(revised);
});

test('editar perfil espacial mostra o efeito salvo, sem herdar a sequência anterior', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  const headers = { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' };
  await page.request.post('/api/control', { headers, data: { effect: 'strobe', palette: ['#ff0000', '#0000ff'], brightness: 100, speed: 100 } });
  const studio = await (await page.request.get('/api/studio')).json();
  await page.request.post('/api/studio/profiles', { headers, data: { name: 'Aurora guardada', activeId: studio.effects[0].id } });
  await page.locator('.nav[data-page=profiles]').click();
  const card = page.locator('#profiles .profile-card').filter({ has: page.getByRole('heading', { name: 'Aurora guardada', exact: true }) });
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('#profile-effect-field')).toBeHidden();
  await expect(page.locator('#profile-map-effect')).toHaveValue(studio.effects[0].id);
  await expect(page.locator('#profile-colors input')).toHaveCount(3);
  await expect(page.locator('#profile-colors input').first()).toHaveValue('#00ff99');
  const before = await (await page.request.get('/api/state')).json();
  await page.locator('#profile-name').fill('Aurora revisada');
  await page.locator('#profile-colors input').first().fill('#112233');
  await page.locator('#profile-map-pattern').selectOption('rain');
  await page.locator('#profile-map-angle').fill('90'); await page.locator('#profile-map-scale').fill('2');
  await page.locator('#profile-speed').fill('17'); await page.locator('#profile-brightness').fill('37');
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/profile-map-editor-${width}.png`, fullPage: true });
  }
  await page.locator('#profile-submit').click(); await expect(page.locator('#profile-form')).toBeHidden();
  const savedState = await (await page.request.get('/api/state')).json();
  const saved = savedState.profiles.find(p => p.name === 'Aurora revisada');
  expect(saved.spatial).toBe(true); expect(saved.mapEffect.palette).toEqual(['#112233', '#00c8ff', '#8156ff']);
  expect(savedState.master).toEqual(before.master); expect(savedState.studio).toEqual(before.studio);
  const effects = (await (await page.request.get('/api/studio')).json()).effects;
  expect(effects.find(e => e.id === saved.studio.activeId)).toMatchObject({ pattern: 'rain', angle: 90, scale: 2, speed: 17 });
  expect(effects.find(e => e.id === studio.effects[0].id).palette).toEqual(['#00ff99', '#00c8ff', '#8156ff']);
  const edited = page.locator('#profiles .profile-card').filter({ has: page.getByRole('heading', { name: 'Aurora revisada', exact: true }) });
  await edited.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('#profile-map-pattern')).toHaveValue('rain'); await expect(page.locator('#profile-map-angle')).toHaveValue('90');
  await expect(page.locator('#profile-brightness')).toHaveValue('37');
  await page.locator('#cancel-profile').click();
  await edited.getByRole('button', { name: 'Ativar no mapa', exact: true }).click();
  await expect(page.locator('[data-view=studio]')).toHaveClass(/active/);
  await expect.poll(async () => (await (await page.request.get('/api/studio')).json()).activeId).toBe(saved.studio.activeId);
});
