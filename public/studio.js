'use strict';
(() => {
  const $ = id => document.getElementById(id), make = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  let api, toast, state, isAdmin = false, current = 'control', data, selected, dirty = false, fpsDirty = false, stream, poll, dragging = false, loading = false;
  const item = () => data?.layout.find(i => i.key === selected);
  function mark() { dirty = true; $('studio-dirty').textContent = 'Alterações não salvas'; }
  function error(e) { toast?.(e.message || String(e)); }
  async function request(route, body, method) { try { return await api(route, body, method); } catch (e) { error(e); return null; } }
  function selection() {
    const value = item(); $('studio-device-form').hidden = !value;
    $('studio-selection-note').hidden = Boolean(value);
    if (!value) return;
    for (const key of ['shape', 'rotation', 'count', 'columns']) $('studio-' + key).value = value[key];
    $('studio-item-name').value = value.name; $('studio-start').value = value.start + 1; $('studio-reverse').checked = value.reverse;
    for (const key of ['x', 'y', 'width', 'height']) $('studio-' + key).value = Math.round(value[key] * 1000) / 10;
  }
  function position(button, value) { button.style.left = value.x * 100 + '%'; button.style.top = value.y * 100 + '%'; button.style.width = value.width * 100 + '%'; button.style.height = value.height * 100 + '%'; button.style.setProperty('--rotation', value.rotation + 'deg'); }
  function map() {
    if (!data) return;
    const container = $('studio-items'); container.replaceChildren(); $('studio-empty').hidden = Boolean(data.layout.length);
    for (const value of data.layout) {
      const button = make('button', undefined, 'studio-item' + (value.key === selected ? ' selected' : '')); button.type = 'button'; button.dataset.key = value.key; button.dataset.shape = value.shape; button.setAttribute('aria-label', 'Posicionar ' + value.name); button.title = value.name + ' · LEDs ' + (value.start + 1) + '–' + (value.start + value.count); position(button, value);
      button.append(make('i'), make('span', value.name)); container.append(button);
      button.addEventListener('click', () => { selected = value.key; selection(); container.querySelectorAll('.studio-item').forEach(b => b.classList.toggle('selected', b === button)); });
      button.addEventListener('pointerdown', event => {
        if (!isAdmin || event.button !== 0) return;
        event.preventDefault(); selected = value.key; dragging = true; selection(); button.classList.add('selected'); button.setPointerCapture(event.pointerId);
        const rect = $('studio-stage').getBoundingClientRect(), origin = { x: event.clientX, y: event.clientY, px: value.x, py: value.y };
        const move = e => { value.x = Math.max(0, Math.min(1, origin.px + (e.clientX - origin.x) / rect.width)); value.y = Math.max(0, Math.min(1, origin.py + (e.clientY - origin.y) / rect.height)); position(button, value); selection(); mark(); };
        const finish = () => { dragging = false; button.removeEventListener('pointermove', move); button.removeEventListener('pointerup', finish); button.removeEventListener('pointercancel', finish); };
        button.addEventListener('pointermove', move); button.addEventListener('pointerup', finish); button.addEventListener('pointercancel', finish);
      });
      button.addEventListener('keydown', event => {
        if (!isAdmin || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); selected = value.key;
        value.x = Math.max(0, Math.min(1, value.x + (event.key === 'ArrowRight' ? 0.01 : event.key === 'ArrowLeft' ? -0.01 : 0)));
        value.y = Math.max(0, Math.min(1, value.y + (event.key === 'ArrowDown' ? 0.01 : event.key === 'ArrowUp' ? -0.01 : 0))); position(button, value); selection(); mark();
      });
    }
    $('studio-map-summary').textContent = data.layout.length + ' posições · ' + data.layout.reduce((n, i) => n + i.count, 0) + ' LEDs mapeados';
  }
  function controls() {
    const effect = data?.effects.find(e => e.id === data.activeId); if (!effect) return;
    $('studio-publisher').textContent = effect.publisher;
    $('studio-effect-note').textContent = (effect.warnings || []).join(' ');
    $('studio-remove-effect').hidden = effect.builtin || !isAdmin;
    const form = $('studio-parameters'); form.replaceChildren();
    for (const control of effect.controls) {
      const label = make('label', control.label); let input;
      if (control.type === 'combobox') { input = make('select'); for (const value of control.values) { const option = make('option', value); option.value = value; input.append(option); } }
      else { input = make('input'); input.type = control.type === 'boolean' ? 'checkbox' : control.type === 'color' ? 'color' : 'number'; if (control.type === 'number') { input.min = control.min; input.max = control.max; input.step = 'any'; } }
      input.dataset.key = control.key; input.dataset.type = control.type; input.setAttribute('aria-label', control.label);
      const value = data.values?.[control.key] ?? control.default; if (control.type === 'boolean') input.checked = value; else input.value = value;
      label.append(input); form.append(label);
    }
    if (effect.controls.length) { const save = make('button', 'Salvar parâmetros', 'button primary'); form.append(save); }
  }
  function renderLibrary() {
    const select = $('studio-effect'); select.replaceChildren();
    for (const effect of data.effects) { const option = make('option', effect.name); option.value = effect.id; select.append(option); }
    select.value = data.activeId; $('studio-enabled').checked = data.enabled; controls();
    $('studio-error').hidden = !data.error; $('studio-error').textContent = data.error || '';
    $('studio-state').textContent = data.error ? 'Efeito pausado' : data.enabled ? 'Mapa nas luzes' : 'Somente prévia';
  }
  async function refresh(keepDraft = true) {
    if (!api || loading || document.hidden || !['studio', 'settings'].includes(current)) return;
    loading = true;
    try {
      const next = await api('/api/studio');
      const old = data, changed = !old || old.activeId !== next.activeId || old.effects.length !== next.effects.length || JSON.stringify(old.values) !== JSON.stringify(next.values);
      const layoutChanged = !old || JSON.stringify(old.layout) !== JSON.stringify(next.layout);
      if (old && dirty && keepDraft) next.layout = old.layout;
      data = next;
      if (current === 'studio') {
        if (changed) { map(); selection(); renderLibrary(); }
        else { $('studio-enabled').checked = data.enabled; $('studio-error').hidden = !data.error; $('studio-error').textContent = data.error || ''; $('studio-state').textContent = data.error ? 'Efeito pausado' : data.enabled ? 'Mapa nas luzes' : 'Somente prévia'; }
        if (layoutChanged && !dirty && !dragging) { map(); selection(); }
      }
      const text = data.metrics.fps ? data.metrics.fps + ' FPS renderizados · ' + data.metrics.renderMs + ' ms/quadro · motor ' + data.metrics.memoryMB + ' MiB' : 'Motor em repouso';
      $('studio-metrics').textContent = text; $('settings-metrics').textContent = text;
    } catch (e) { error(e); } finally { loading = false; }
  }
  async function play(body) { const next = await request('/api/studio/play', body, 'POST'); if (next) { if (dirty) next.layout = data.layout; data = next; renderLibrary(); map(); selection(); } }
  $('studio-effect').addEventListener('change', () => play({ activeId: $('studio-effect').value }));
  $('studio-enabled').addEventListener('change', () => play({ enabled: $('studio-enabled').checked }));
  $('studio-parameters').addEventListener('submit', event => {
    event.preventDefault(); const values = {};
    for (const input of $('studio-parameters').querySelectorAll('[data-key]')) values[input.dataset.key] = input.dataset.type === 'boolean' ? input.checked : input.dataset.type === 'number' ? Number(input.value) : input.value;
    play({ values });
  });
  $('studio-save').addEventListener('click', async () => {
    const result = await request('/api/studio', { layout: data.layout }, 'POST');
    if (result) { data = result; dirty = false; $('studio-dirty').textContent = 'Mapa salvo'; map(); toast('Posições salvas.'); }
  });
  $('studio-reset').addEventListener('click', () => { data.layout = NexusSpatial.defaults(state.hardware.devices.filter(d => d.ledCount > 0 && d.effects.includes('wave'))); selected = null; mark(); map(); selection(); });
  $('studio-device-form').addEventListener('submit', e => e.preventDefault());
  $('studio-device-form').addEventListener('change', () => {
    const value = item(); if (!value) return;
    value.name = $('studio-item-name').value;
    for (const key of ['rotation', 'count', 'columns']) value[key] = Number($('studio-' + key).value);
    for (const key of ['x', 'y', 'width', 'height']) value[key] = Number($('studio-' + key).value) / 100;
    value.start = Number($('studio-start').value) - 1; value.shape = $('studio-shape').value; value.reverse = $('studio-reverse').checked;
    mark(); map();
  });
  $('studio-split').addEventListener('click', () => {
    const value = item(); if (!value || value.count < 2) return toast('Este componente não tem LEDs suficientes para dividir.');
    const first = Math.floor(value.count / 2), second = { ...value, key: crypto.randomUUID(), start: value.start + first, count: value.count - first, x: Math.min(0.94, value.x + 0.14), name: value.name.slice(0, 48) + ' · parte 2' };
    value.count = first; data.layout.push(second); selected = second.key; mark(); map(); selection();
  });
  $('studio-merge').addEventListener('click', () => {
    const value = item(), other = value && data.layout.find(i => i.key !== value.key && i.deviceId === value.deviceId && (i.start + i.count === value.start || value.start + value.count === i.start));
    if (!other) return toast('Selecione uma divisão com faixa de LEDs vizinha.');
    value.start = Math.min(value.start, other.start); value.count += other.count; data.layout = data.layout.filter(i => i !== other); mark(); map(); selection();
  });
  async function importSource(source) {
    const result = await request('/api/studio/import', { source }, 'POST');
    if (result) { if (dirty) result.layout = data.layout; data = result; renderLibrary(); toast('Efeito adicionado à biblioteca. Escolha-o na lista para visualizar.'); }
  }
  $('studio-import').addEventListener('change', async event => {
    const input = event.target; input.disabled = true;
    try { for (const file of Array.from(input.files).slice(0, 32)) { if (file.size > 128 * 1024) { toast(file.name + ': limite de 128 KiB.'); continue; } await importSource(await file.text()); } } finally { input.value = ''; input.disabled = false; }
  });
  $('studio-new').addEventListener('click', () => {
    $('studio-source').value = JSON.stringify({ format: 'nexus-effect/1', name: 'Minha onda', pattern: 'wave', palette: ['#00f0ff', '#7954ff', '#ff0055'], speed: 30, angle: 0, scale: 1 }, null, 2);
    $('studio-formula-form').hidden = false; $('studio-source').focus();
  });
  $('studio-formula-close').addEventListener('click', () => { $('studio-formula-form').hidden = true; });
  $('studio-formula-form').addEventListener('submit', async event => { event.preventDefault(); await importSource($('studio-source').value); });
  $('studio-remove-effect').addEventListener('click', async () => { const result = await request('/api/studio/effects/' + data.activeId, undefined, 'DELETE'); if (result) { data = result; renderLibrary(); } });
  function fpsLabel() { const fps = Number($('settings-fps').value); $('settings-fps-label').textContent = fps + ' FPS'; document.querySelectorAll('[data-fps]').forEach(b => b.classList.toggle('active', Number(b.dataset.fps) === fps)); }
  $('settings-fps').addEventListener('input', () => { fpsDirty = true; fpsLabel(); });
  document.querySelectorAll('[data-fps]').forEach(button => button.addEventListener('click', () => { fpsDirty = true; $('settings-fps').value = button.dataset.fps; fpsLabel(); }));
  $('settings-fps-form').addEventListener('submit', async event => { event.preventDefault(); const result = await request('/api/settings', { fps: Number($('settings-fps').value) }, 'POST'); if (result) { fpsDirty = false; $('settings-fps').value = result.performance.fps; fpsLabel(); toast('Taxa salva. Os efeitos usam o novo limite sem reiniciar o controlador.'); } });
  function open(name) {
    current = name; clearInterval(poll); stream?.close(); stream = null;
    if (!api || !['studio', 'settings'].includes(name) || document.hidden) return;
    refresh();
    poll = setInterval(refresh, 3000);
    if (name === 'studio') {
      stream = new EventSource('/api/studio/preview');
      stream.onmessage = event => { try { const frame = JSON.parse(event.data); $('studio-preview').src = 'data:image/png;base64,' + frame.image; } catch {} };
    } else if (isAdmin) api('/api/network').then(n => { $('settings-ports').textContent = 'Painel TCP ' + n.ports.panel + ' · SDK TCP ' + n.ports.sdk + ' · Alexa TCP ' + n.ports.alexa + ' · descoberta UDP 1900.'; }).catch(error);
  }
  document.addEventListener('visibilitychange', () => open(current));
  window.addEventListener('pagehide', () => { clearInterval(poll); stream?.close(); stream = null; });
  window.NexusStudio = {
    open,
    update(next, admin, requestApi, showToast, page) {
      const first = !api; state = next; isAdmin = admin; api = requestApi; toast = showToast;
      document.querySelectorAll('.studio-admin').forEach(e => { if (!e.closest('#studio-formula-form')) e.hidden = !admin; }); $('settings-fps-save').disabled = !admin; $('settings-fps').disabled = !admin;
      document.querySelectorAll('[data-fps]').forEach(e => { e.disabled = !admin; }); $('settings-admin-note').hidden = admin;
      if (!fpsDirty && document.activeElement !== $('settings-fps')) { $('settings-fps').value = next.performance?.fps || 20; fpsLabel(); }
      if (first) open(page);
    }
  };
})();
