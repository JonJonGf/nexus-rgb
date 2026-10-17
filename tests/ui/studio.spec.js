const { test, expect } = require('./fixture');
test.use({ serviceWorkers: 'block' });
test('mapa salva ao soltar, preserva o efeito e mantém peças associadas após as atualizações', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const devices = [0, 1, 2].map(i => ({ id: String(i + 1).padStart(24, '0'), name: i === 2 ? 'ARGB de teste' : 'RAM ' + (i + 1), vendor: 'Teste', type: i < 2 ? 1 : 0, kind: i === 2 ? 'argb' : 'device', ledCount: i === 2 ? 24 : 8, status: 'online', settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static', 'wave'], modes: [], zones: [] }));
  await page.route('**/api/state', async route => { const response = await route.fetch(); const body = await response.json(); body.hardware = { connected: true, controllerCount: 3, devices }; await route.fulfill({ json: body }); });
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-state')).not.toHaveText('Prévia');
  // Use the same default layout helper as the product, with virtual fixture devices.
  const layout = await page.evaluate(ds => NexusSpatial.defaults(ds), devices);
  await page.request.post('/api/studio', { headers: { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' }, data: { layout, enabled: true } });
  await page.locator('.nav[data-page=control]').click(); await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('.studio-item')).toHaveCount(3);
  await page.locator('#studio-device-chips button').last().click();
  await page.locator('.studio-shapes [data-shape=fan]').click();
  await expect(page.locator('.studio-shapes [data-shape=fan]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#studio-item-name').fill('ARGB editado'); await page.locator('#studio-item-name').press('Tab');
  await expect(page.locator('#studio-device-chips button').last()).toHaveText('ARGB editado');
  await expect(page.locator('#studio-dirty')).toHaveText('Salvo automaticamente');
  await page.locator('#studio-tab-device').focus(); await page.keyboard.press('ArrowRight'); await expect(page.locator('#studio-tab-effect')).toHaveAttribute('aria-selected','true'); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#studio-device-form .studio-detail').first()).not.toHaveAttribute('open');
  const target = page.locator('.studio-item').last(); const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 75, box.y + box.height / 2 + 30, { steps: 8 });
  await expect(page.locator('#studio-dirty')).toHaveText('Solte para salvar a posição');
  const during = (await (await page.request.get('/api/studio')).json()); expect(during.layout.at(-1).x).toBe(layout.at(-1).x);
  await page.mouse.up(); await expect(page.locator('#studio-dirty')).toHaveText('Salvo automaticamente');
  await expect.poll(async () => { const s = await (await page.request.get('/api/studio')).json(); return s.enabled && s.layout.at(-1).x < layout.at(-1).x - 0.01; }).toBe(true);
  const moved = (await (await page.request.get('/api/studio')).json()).layout.at(-1).x;
  await target.press('ArrowRight');
  await expect.poll(async () => (await (await page.request.get('/api/studio')).json()).layout.at(-1).x).toBeCloseTo(moved + 0.01, 5);
  await expect(page.locator('#studio-dirty')).toHaveText('Salvo automaticamente');
  await page.waitForResponse(r => r.url().endsWith('/api/studio') && r.request().method() === 'GET');
  await target.press('ArrowRight');
  await expect.poll(async () => (await (await page.request.get('/api/studio')).json()).layout.at(-1).x).toBeCloseTo(moved + 0.02, 5);
  await expect(page.locator('#studio-enabled')).toHaveCount(0); await expect(page.locator('#studio-save')).toHaveCount(0);
  await page.getByText('Conexão e sequência de LEDs', {exact:true}).click(); await page.getByText('Várias ventoinhas neste conector?', {exact:true}).click(); await page.locator('#studio-fan-leds').fill('8'); await page.locator('#studio-fan-split').click(); await expect(page.locator('.studio-item')).toHaveCount(5);
  await expect(page.locator('#studio-dirty')).toHaveText('Salvo automaticamente');
  await expect(page.locator('#studio-preview')).toBeHidden(); // The SDK is disabled in this fixture.
  await expect(page.locator('#studio-leds')).toBeVisible();
  const savedMap = await (await page.request.get('/api/studio')).json();
  const image = await page.locator('#studio-leds').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
  const packet = { image, layout: savedMap.layout, enabled: true, power: true, connected: true, output: devices.map(d => ({ id: d.id, source: 'map', rgb: Buffer.from(Array.from({ length: d.ledCount }, (_, n) => d.ledCount === 24 && n >= 12 ? [0, 255, 0] : [255, 0, 0]).flat()).toString('base64') })) };
  await page.route('**/api/studio/preview', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 50000\ndata: ' + JSON.stringify(packet) + '\n\n' }));
  await page.locator('.nav[data-page=control]').click(); await page.locator('.nav[data-page=studio]').click();
  await expect.poll(() => page.evaluate(layout => {
    const ctx = document.getElementById('studio-leds').getContext('2d'), entry = layout.find(i => i.start >= 12), point = NexusSpatial.points(entry)[0];
    return Array.from(ctx.getImageData(Math.round(point.x * 3), Math.round(point.y * 3), 1, 1).data).slice(0, 3);
  }, packet.layout)).toEqual([0, 255, 0]);
  await page.locator('#studio-choose').click(); await page.locator('#studio-new').click(); const recipe = { format: 'nexus-effect/1', name: 'Minha onda no mapa', pattern: 'wave', palette: ['#ff0055', '#00f0ff'], speed: 20, angle: 45, scale: 1 };
  await expect(page.locator('#studio-formula-dialog')).toBeVisible(); await page.locator('#formula-advanced summary').click();
  await page.locator('#studio-source').fill(JSON.stringify(recipe)); await page.locator('#formula-save').click();
  await expect.poll(async () => (await (await page.request.get('/api/studio')).json()).effects.some(e => e.name === 'Minha onda no mapa')).toBe(true); await expect(page.locator('#studio-formula-dialog')).not.toBeVisible();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).profiles.some(p => p.name === 'Minha onda no mapa' && p.spatial)).toBe(true);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/mapa-' + width + '.png', fullPage: true });
  }
  await page.reload(); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=studio]').click(); await expect(page.locator('.studio-item')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('criador visual fica sobre o mapa no desktop e celular e guarda um perfil sem aplicar', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-state')).not.toHaveText('Prévia'); const before = await (await page.request.get('/api/studio')).json();
  await page.locator('#studio-choose').click(); await page.locator('#studio-new').click();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
    const box = await page.locator('#studio-formula-dialog').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(width > 800 ? 900 : 844);
    expect(await page.locator('#formula-save').evaluate(b => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; })).toBe(true);
    await page.screenshot({ path: 'test-results/criador-' + width + '.png' });
  }
  await page.locator('#formula-name').fill('Minha onda vertical'); await page.locator('#formula-pattern').selectOption('wave'); await page.locator('#formula-angle').fill('90');
  await page.locator('#formula-save').click(); await expect(page.locator('#studio-formula-dialog')).not.toBeVisible();
  const after = await (await page.request.get('/api/studio')).json(); expect(after.activeId).toBe(before.activeId); expect(after.enabled).toBe(before.enabled);
  await page.locator('.nav[data-page=profiles]').click(); const card = page.locator('#profiles .profile-card').filter({ has: page.getByRole('heading', { name: 'Minha onda vertical', exact: true }) });
  await expect(card).toBeVisible(); await expect(card).toContainText('Efeito no mapa'); await card.getByRole('button', { name: 'Ativar perfil', exact: true }).click();
  await expect.poll(async () => { const s = await (await page.request.get('/api/studio')).json(); return s.enabled && s.effects.find(e => e.id === s.activeId)?.name; }).toBe('Minha onda vertical');
});
test('configurações permitem escolher e persistir FPS sem reiniciar o servidor', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=settings]').click();
  await expect(page.locator('#settings-restart')).toBeVisible(); await expect(page.locator('#settings-restart')).toHaveAttribute('href', 'nexusrgb://restart');
  await page.locator('[data-fps="60"]').click(); await expect(page.locator('#settings-fps-label')).toHaveText('60 FPS');
  await page.locator('#settings-fps-save').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).performance.fps).toBe(60);
  await page.reload(); await expect(page.locator('#power')).toBeEnabled(); await page.locator('.nav[data-page=settings]').click(); await expect(page.locator('#settings-fps')).toHaveValue('60');
  await page.locator('[data-fps="20"]').click(); await page.locator('#settings-fps-save').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).performance.fps).toBe(20);
});

test('mapa compartilha movimentos e perfis e mostra a saída comum sem um fundo espacial antigo', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  const headers = { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' };
  await page.request.post('/api/control', { headers, data: { effect: 'rainbow', power: true } });
  const device = { id: '9'.repeat(24), name: 'ARGB compartilhado', kind: 'argb', ledCount: 12, type: 2 };
  const layout = await page.evaluate(ds => NexusSpatial.defaults(ds), [device]);
  await page.request.post('/api/studio', { headers, data: { layout } });
  const rgb = Buffer.from(Array.from({ length: 12 }, (_, n) => n < 6 ? [255, 0, 0] : [0, 255, 0]).flat()).toString('base64');
  const packet = { image: null, layout, enabled: false, power: true, connected: true, playback: { spatial: false, effect: 'rainbow', name: null }, output: [{ id: device.id, source: 'software', rgb }] };
  await page.route('**/api/studio/preview', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 50000\ndata: ' + JSON.stringify(packet) + '\n\n' }));
  await page.locator('.nav[data-page=studio]').click(); await expect(page.locator('#studio-current-effect')).toHaveText('Arco-íris');
  await expect(page.locator('#studio-preview')).toBeHidden(); await expect(page.locator('#studio-preview')).not.toHaveAttribute('src');
  await expect.poll(() => page.evaluate(entry => {
    const ctx = document.getElementById('studio-leds').getContext('2d');
    return [0, 6].map(index => { const point = NexusSpatial.points(entry)[index]; return Array.from(ctx.getImageData(Math.round(point.x * 3), Math.round(point.y * 3), 1, 1).data).slice(0, 3); });
  }, layout[0])).toEqual([[255, 0, 0], [0, 255, 0]]);
  const piece = page.locator('.studio-item'); await piece.press('ArrowLeft'); await expect(page.locator('#studio-dirty')).toHaveText('Salvo automaticamente');
  expect((await (await page.request.get('/api/studio')).json()).enabled).toBe(false);
  await page.unroute('**/api/studio/preview'); await page.locator('.nav[data-page=control]').click(); await page.locator('.nav[data-page=studio]').click();
  await page.locator('#studio-choose').click(); await page.locator('.library-card[data-kind=motion][data-id=scanner]').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).master.effect).toBe('scanner');
  expect((await page.request.post('/api/profiles', { headers, data: { name: 'Paleta compartilhada', settings: { effect: 'sequence', palette: ['#00ff00', '#ff0000'], brightness: 31, speed: 25 } } })).status()).toBe(200);
  await page.locator('#studio-choose').click(); await expect(page.locator('#studio-library')).toContainText('Paleta compartilhada');
  const profileId = (await (await page.request.get('/api/state')).json()).profiles.find(p => p.name === 'Paleta compartilhada').id;
  await page.locator('.library-card[data-kind=profile][data-id="' + profileId + '"]').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).master.effect).toBe('sequence');
  await expect(page.locator('#studio-effect-heading')).toHaveText('Sequência');
  await page.locator('#studio-choose').click(); await page.locator('.library-card[data-kind=preset][data-id=nebulosa]').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).master.color).toBe('#b75cff');
  const studio = await (await page.request.get('/api/studio')).json(), effect = studio.effects.find(e => e.builtin);
  await page.request.post('/api/studio/profiles', { headers, data: { name: 'Espacial compartilhado', activeId: effect.id } });
  await page.locator('#studio-choose').click(); await expect(page.locator('#studio-library')).toContainText('Espacial compartilhado');
  const spatialId = (await (await page.request.get('/api/state')).json()).profiles.find(p => p.name === 'Espacial compartilhado').id;
  await page.locator('.library-card[data-kind=profile][data-id="' + spatialId + '"]').click();
  await expect.poll(async () => (await (await page.request.get('/api/studio')).json()).enabled).toBe(true);
  await expect(page.locator('#studio-toggle')).not.toHaveAttribute('hidden');
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/mapa-compartilhado-' + width + '.png', fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('resposta antiga de um comando não remove um perfil recebido pelo stream', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('[data-page=studio]').click(); await page.locator('#studio-choose').click();
  const name='Perfil durante comando '+Date.now(),headers={Origin:new URL(page.url()).origin,'X-Nexus-Client':'web'};
  await page.route('**/api/control',async route=>{
    const response=await route.fetch(),old=await response.json();
    expect((await page.request.post('/api/profiles',{headers,data:{name}})).status()).toBe(200);
    await expect(page.locator('#profiles')).toContainText(name);
    await route.fulfill({json:old});
  });
  await page.locator('.library-card[data-kind=motion][data-id=wave]').click();
  await expect(page.locator('#studio-picker-dialog')).not.toBeVisible();
  await page.locator('#studio-choose').click();
  await expect(page.locator('#studio-library')).toContainText(name);
});

test('indicador fora do mapa, botão Voltar a seguir o mapa e reconexão da prévia funcionam na interface', async ({ page }) => {
  const id = '1'.repeat(24);
  let excluded = true, customized = true, previewCalls = 0;
  const device = () => ({ id, name: 'RAM personalizada', vendor: 'Teste', type: 1, kind: 'device', ledCount: 8, status: 'online', customized, mapExcluded: excluded, settings: { power: true, color: customized ? '#ff0055' : '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static', 'wave'], modes: [], zones: [] });
  const mockState = async () => {
    const s = await (await page.request.get('/api/state')).json();
    s.hardware = { connected: true, controllerCount: 1, error: null, devices: [device()] };
    return s;
  };
  await page.route('**/api/state', async route => route.fulfill({ json: await mockState() }));
  await page.route('**/api/events', async route => route.fulfill({ headers: { 'Content-Type': 'text/event-stream' }, body: `retry: 60000\ndata: ${JSON.stringify(await mockState())}\n\n` }));
  await page.route('**/api/studio', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    try {
      const response = await route.fetch();
      const body = await response.json();
      body.excluded = excluded ? [id] : [];
      await route.fulfill({ json: body });
    } catch {
      await route.continue().catch(() => {});
    }
  });
  await page.route('**/api/devices/' + id, async route => {
    const payload = route.request().postDataJSON();
    if (payload?.followMap === true) { excluded = false; customized = false; }
    const body = await mockState();
    await route.fulfill({ status: 200, json: body });
  });
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  const layout = await page.evaluate(ds => NexusSpatial.defaults(ds), [device()]);
  await page.request.post('/api/studio', { headers: { Origin: new URL(page.url()).origin, 'X-Nexus-Client': 'web' }, data: { layout, enabled: true } });

  await page.locator('.nav[data-page=devices]').click();
  await expect(page.locator('#devices')).toContainText('Ajuste individual · fora do mapa');
  await expect(page.locator('#devices .follow-map-button')).toBeVisible();

  await page.route('**/api/studio/preview', async route => {
    previewCalls++;
    if (previewCalls === 1) return route.fulfill({ status: 503, body: ' ocupada ' });
    const packet = { image: null, layout, enabled: true, power: true, connected: true, playback: { spatial: true, effect: null, name: 'Aurora espacial' }, output: [{ id, source: 'map', rgb: Buffer.from(Array(24).fill(120)).toString('base64') }] };
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 50000\ndata: ' + JSON.stringify(packet) + '\n\n' });
  });

  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('.studio-item.excluded')).toHaveCount(1);
  await page.locator('.studio-item.excluded').first().click();
  await expect(page.locator('#studio-piece-excluded')).toBeVisible();
  await expect(page.locator('#studio-follow-map')).toBeVisible();
  await expect.poll(() => previewCalls, { timeout: 6000 }).toBeGreaterThanOrEqual(2);

  await page.locator('#studio-follow-map').click();
  await expect(page.locator('.studio-item.excluded')).toHaveCount(0);
  await expect(page.locator('#studio-piece-excluded')).toBeHidden();
});

test('painel de recuperação explica falha do efeito, restaura último funcional e permite manter luzes apagadas', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  const initialStudio = await (await page.request.get('/api/studio')).json();
  const validEffect = initialStudio.effects.find(e => e.builtin);
  let recoveredAction = null;
  let failureActive = true;
  const mockRecovery = () => ({
    active: true,
    kind: 'effect',
    message: 'O efeito excedeu o tempo de resposta e foi pausado.',
    attempts: 3,
    maxAttempts: 3,
    quarantined: true,
    retrying: false,
    controllerConfirmed: false,
    controllerState: 'unconfirmed',
    lastWorking: { activeId: validEffect.id, name: validEffect.name, promotedAt: Date.now() },
    actions: ['retry', 'last-working', 'lights-off']
  });
  await page.route('**/api/studio', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    if (failureActive) {
      body.enabled = true;
      body.error = 'O efeito excedeu o tempo de resposta e foi pausado.';
      body.recovery = mockRecovery();
    }
    await route.fulfill({ json: body });
  });
  await page.route('**/api/studio/preview', async route => {
    const packet = {
      image: null,
      layout: initialStudio.layout,
      enabled: true,
      power: true,
      connected: !failureActive,
      error: failureActive ? 'O efeito excedeu o tempo de resposta e foi pausado.' : null,
      recovery: failureActive ? mockRecovery() : { active: false, kind: null, message: null, attempts: 0, maxAttempts: 3, quarantined: false, retrying: false, controllerConfirmed: true, controllerState: 'spatial', lastWorking: { activeId: validEffect.id, name: validEffect.name, promotedAt: Date.now() }, actions: [] },
      playback: { spatial: !failureActive, effect: 'static', name: validEffect.name },
      output: []
    };
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'retry: 50000\ndata: ' + JSON.stringify(packet) + '\n\n' });
  });
  await page.route('**/api/studio/recover', async route => {
    const reqBody = route.request().postDataJSON();
    recoveredAction = reqBody.action;
    if (reqBody.action === 'last-working') failureActive = false;
    const res = await route.fetch();
    const body = await res.json();
    if (failureActive) {
      body.enabled = true;
      body.error = 'O efeito excedeu o tempo de resposta e foi pausado.';
      body.recovery = mockRecovery();
    } else {
      body.error = null;
      body.recovery = { active: false, kind: null, message: null, attempts: 0, maxAttempts: 3, quarantined: false, retrying: false, controllerConfirmed: true, controllerState: 'spatial', lastWorking: { activeId: validEffect.id, name: validEffect.name, promotedAt: Date.now() }, actions: [] };
    }
    await route.fulfill({ status: 200, json: body });
  });

  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-recovery')).toBeVisible();
  await expect(page.locator('#studio-recovery-kind')).toHaveText('ERRO DO EFEITO');
  await expect(page.locator('#studio-recovery-message')).toHaveText('O efeito excedeu o tempo de resposta e foi pausado.');
  await expect(page.locator('#studio-recovery-detail')).toContainText('o estado físico do último quadro nas luzes não pôde ser confirmado');
  await expect(page.locator('#studio-recover-retry')).toBeVisible();
  await expect(page.locator('#studio-recover-last')).toBeVisible();
  await expect(page.locator('#studio-recover-off')).toBeVisible();

  await page.locator('#studio-recover-off').click();
  expect(recoveredAction).toBe('lights-off');
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).master.power).toBe(false);

  await page.locator('#studio-recover-last').click();
  expect(recoveredAction).toBe('last-working');
  await expect(page.locator('#studio-recovery')).toBeHidden();
});

test('configuração de transição suave de energia salva duração e informa fallback para modo nativo', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#power')).toBeEnabled();
  await page.locator('.nav[data-page=settings]').click();
  await expect(page.locator('#settings-power-transition')).toHaveValue('0');
  await expect(page.locator('#settings-power-transition-label')).toHaveText('Instantânea');

  await page.locator('#settings-power-transition').selectOption('800');
  await expect(page.locator('#settings-power-transition-label')).toHaveText('0,8 s');
  await page.locator('#settings-fps-save').click();

  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).performance.powerTransitionMs).toBe(800);

  // Reset to instant default (0) and verify persistence:
  await page.locator('#settings-power-transition').selectOption('0');
  await page.locator('#settings-fps-save').click();
  await expect.poll(async () => (await (await page.request.get('/api/state')).json()).performance.powerTransitionMs || 0).toBe(0);
  await expect(page.locator('#settings-power-transition-label')).toHaveText('Instantânea');
});

test('sincronização do mapa em etapas, reconexão de hardware, proteção contra resposta obsoleta e undo/redo no navegador', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const ramDevice = { id: '000000000000000000000001', name: 'RAM RGB', vendor: 'Teste', type: 1, kind: 'device', ledCount: 8, status: 'online', settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static', 'wave'], modes: [], zones: [] };
  const moboDevice = { id: '000000000000000000000002', name: 'Placa-mãe', vendor: 'Teste', type: 0, kind: 'device', ledCount: 16, status: 'online', settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static', 'wave'], modes: [], zones: [] };
  const gpuDevice = { id: '000000000000000000000003', name: 'Placa de vídeo', vendor: 'Teste', type: 2, kind: 'device', ledCount: 16, status: 'online', settings: { power: true, color: '#00f0ff', brightness: 80, speed: 40, effect: 'static' }, effects: ['static', 'wave'], modes: [], zones: [] };

  let currentHardware = { connected: false, controllerCount: 0, error: null, devices: [] };
  let currentStudioLayout = [];

  await page.route('**/api/state', async route => {
    const body = await (await route.fetch()).json();
    body.hardware = currentHardware;
    await route.fulfill({ json: body });
  });

  await page.route('**/api/events', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `retry: 60000\ndata: ${JSON.stringify({ time: Date.now(), hardware: currentHardware, master: { power: true, brightness: 100, color: '#00f0ff', effect: 'static' }, studio: { excluded: [] }, profiles: [], presets: [], performance: { fps: 20 }, alexa: { enabled: false, status: 'desativada' } })}\n\n`
    });
  });

  let studioLayoutRevision = 1;
  await page.route('**/api/studio', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        json: {
          layout: currentStudioLayout,
          layoutRevision: studioLayoutRevision,
          enabled: true,
          activeId: 'builtin-wave',
          effects: [{ id: 'builtin-wave', name: 'Onda', builtin: true, format: 'nexus-effect/1', controls: [] }],
          values: {},
          metrics: { fps: 20, renderMs: 2, memoryMB: 15 }
        }
      });
    }
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      if (payload?.layout) {
        currentStudioLayout = payload.layout;
        studioLayoutRevision++;
      }
      return route.fulfill({
        status: 200,
        json: {
          layout: currentStudioLayout,
          layoutRevision: studioLayoutRevision,
          enabled: true,
          activeId: 'builtin-wave',
          effects: [{ id: 'builtin-wave', name: 'Onda', builtin: true, format: 'nexus-effect/1', controls: [] }],
          values: {},
          metrics: { fps: 20, renderMs: 2, memoryMB: 15 }
        }
      });
    }
    await route.continue();
  });

  const updateStudio = async hw => {
    await page.evaluate(hardware => {
      const state = {
        hardware,
        master: { power: true, brightness: 100, color: '#00f0ff', effect: 'static' },
        performance: { fps: 20 },
        studio: { excluded: [] },
        profiles: [],
        presets: []
      };
      window.NexusStudio?.update?.(state, true, (r, b, m) => fetch(r, { method: m, body: b ? JSON.stringify(b) : undefined, headers: { 'Content-Type': 'application/json' } }).then(res => res.json()), () => {}, 'studio');
    }, hw);
  };

  // 1. Open Studio without devices
  await page.goto('/');
  await page.locator('.nav[data-page=studio]').click();

  await expect(page.locator('#studio-empty')).toBeVisible();
  await expect(page.locator('.studio-item')).toHaveCount(0);
  await expect(page.locator('#studio-device-chips button')).toHaveCount(0);
  await expect(page.locator('#studio-device-form')).toBeHidden();

  // 2. Stage 1: RAM appears without page reload or effect change
  currentHardware = { connected: true, controllerCount: 1, error: null, devices: [ramDevice] };
  currentStudioLayout = await page.evaluate(ds => NexusSpatial.defaults(ds), [ramDevice]);

  await updateStudio(currentHardware);

  await expect(page.locator('#studio-empty')).toBeHidden();
  await expect(page.locator('.studio-item')).toHaveCount(1);
  await expect(page.locator('#studio-device-chips button')).toHaveCount(1);
  await expect(page.locator('#studio-device-chips button').first()).toHaveText('RAM RGB');
  await expect(page.locator('#studio-device-form')).toBeVisible();
  await expect(page.locator('#studio-item-name')).toHaveValue('RAM RGB');

  // Stage 2: Motherboard appears in stage 2
  currentHardware = { connected: true, controllerCount: 2, error: null, devices: [ramDevice, moboDevice] };
  currentStudioLayout = await page.evaluate(ds => NexusSpatial.defaults(ds), [ramDevice, moboDevice]);

  await updateStudio(currentHardware);

  await expect(page.locator('.studio-item')).toHaveCount(2);
  await expect(page.locator('#studio-device-chips button')).toHaveCount(2);

  // 3. Controller disconnect & reconnect without changing effect
  currentHardware = { connected: false, controllerCount: 2, error: 'Controlador desconectado.', devices: [ramDevice, moboDevice] };
  await updateStudio(currentHardware);

  currentHardware = { connected: true, controllerCount: 2, error: null, devices: [ramDevice, moboDevice] };
  await updateStudio(currentHardware);

  await expect(page.locator('.studio-item')).toHaveCount(2);
  await expect(page.locator('#studio-empty')).toBeHidden();

  // 4. Identity / capability change with same device count (RAM replaced with GPU)
  currentHardware = { connected: true, controllerCount: 2, error: null, devices: [gpuDevice, moboDevice] };
  currentStudioLayout = await page.evaluate(ds => NexusSpatial.defaults(ds), [gpuDevice, moboDevice]);
  await updateStudio(currentHardware);

  await expect(page.locator('.studio-item')).toHaveCount(2);
  await expect(page.locator('#studio-device-chips')).toContainText('Placa de vídeo');

  // 5. Select, drag, drop, persistence, and undo/redo
  const piece = page.locator('.studio-item').first();
  await piece.click();
  const initBox = await piece.boundingBox();
  await page.mouse.move(initBox.x + initBox.width / 2, initBox.y + initBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(initBox.x + initBox.width / 2 + 50, initBox.y + initBox.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#studio-dirty')).toHaveText('Salvo automaticamente');

  // Undo position
  await expect(page.locator('#map-undo')).toBeVisible();
  await page.locator('#map-undo').click();
  await expect(page.locator('#map-redo')).toBeVisible();
  // Redo position
  await page.locator('#map-redo').click();

  // 6. Stale out-of-order HTTP response rejection (seq guard)
  let delayedResolve;
  const delayedPromise = new Promise(res => { delayedResolve = res; });
  let intercepted = false;
  await page.route('**/api/studio', async route => {
    if (!intercepted && route.request().method() === 'GET') {
      intercepted = true;
      await delayedPromise;
      return route.fulfill({
        status: 200,
        json: {
          layout: [{ key: 'old-stale-key', name: 'Stale Piece', count: 4, start: 0, x: 0, y: 0, width: 0.1, height: 0.1, rotation: 0, shape: 'strip' }],
          layoutRevision: 0,
          enabled: true,
          activeId: 'builtin-wave',
          effects: [{ id: 'builtin-wave', name: 'Onda', builtin: true, controls: [] }],
          values: {},
          metrics: { fps: 20, renderMs: 2, memoryMB: 15 }
        }
      });
    }
    return route.fulfill({
      status: 200,
      json: {
        layout: currentStudioLayout,
        layoutRevision: studioLayoutRevision,
        enabled: true,
        activeId: 'builtin-wave',
        effects: [{ id: 'builtin-wave', name: 'Onda', builtin: true, controls: [] }],
        values: {},
        metrics: { fps: 20, renderMs: 2, memoryMB: 15 }
      }
    });
  });

  await updateStudio(currentHardware);
  delayedResolve();
  await page.waitForTimeout(100);

  // Stale layout must NOT replace current active layout
  await expect(page.locator('.studio-item')).toHaveCount(2);
  await expect(page.locator('.studio-item[data-key="old-stale-key"]')).toHaveCount(0);

  // 7. Responsive viewports and PT/EN without page reload
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  // Switch to English
  await page.locator('.nav[data-page=settings]').click();
  await page.locator('#settings-language').selectOption('en');
  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-tab-device')).toHaveText('Device');

  // Switch back to Portuguese
  await page.locator('.nav[data-page=settings]').click();
  await page.locator('#settings-language').selectOption('pt-BR');
  await page.locator('.nav[data-page=studio]').click();
  await expect(page.locator('#studio-tab-device')).toHaveText('Componente');

  expect(errors).toEqual([]);
});
