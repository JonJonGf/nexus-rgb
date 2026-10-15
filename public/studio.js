'use strict';
(() => {
  const $ = id => document.getElementById(id), make = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  let api, toast, state, isAdmin = false, current = 'control', data, selected, dirty = false, fpsDirty = false, stream, poll, dragging = false, loading = false;
  const item = () => data?.layout.find(i => i.key === selected);
  let liveFrame;
  let editVersion = 0, savedVersion = 0, saving = false, saveTimer, lastSave = 0;
  function mark() { editVersion++; dirty = true; $('studio-dirty').textContent = 'Atualizando luzes…'; $('studio-retry').hidden = true; scheduleSave(); drawOutput(); }
  function scheduleSave() {
    clearTimeout(saveTimer);
    if (saving || !dirty) return;
    // Coalesce pointer events and stay below the LAN API request budget,
    // including the metadata poll. The first movement is sent immediately.
    saveTimer = setTimeout(saveLayout, Math.max(0, lastSave + 350 - Date.now()));
  }
  async function saveLayout() {
    if (saving || !dirty || !isAdmin) return;
    saving = true; lastSave = Date.now(); const version = editVersion;
    try {
      const next = await api('/api/studio', { layout: structuredClone(data.layout), enabled: true }, 'POST');
      savedVersion = version; dirty = editVersion !== savedVersion;
      // Buttons retain references to these items in their pointer handlers.
      // An acknowledgement must not swap them for detached JSON objects.
      next.layout = data.layout;
      data = next; status();
      $('studio-dirty').textContent = dirty ? 'Atualizando luzes…' : 'Salvo automaticamente';
      $('studio-retry').hidden = true;
    } catch (e) {
      $('studio-dirty').textContent = 'Não foi possível salvar'; $('studio-retry').hidden = false; error(e);
      // Keep the local edit for an explicit retry; do not flood a failed API.
      return;
    } finally { saving = false; }
    if (dirty) scheduleSave();
  }
  function drawOutput() {
    const canvas = $('studio-leds'), ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!liveFrame?.layout) return;
    const output = new Map((liveFrame.output || []).map(d => [d.id, { ...d, bytes: d.rgb ? atob(d.rgb) : '' }]));
    // Draw the piece and its markers from the same editable geometry. Colors
    // still come from the last SDK write, including while an edit is pending.
    const localLayout = data?.layout;
    const layout = localLayout && localLayout.every(i => Number.isInteger(i.count) && i.count > 0 && i.count <= 4096) && localLayout.reduce((n, i) => n + i.count, 0) <= 32768 ? localLayout : liveFrame.layout;
    const count = layout.reduce((sum, i) => sum + i.count, 0), stride = Math.max(1, Math.ceil(count / 4096)); let n = 0;
    for (const entry of layout) {
      const sent = output.get(entry.deviceId);
      for (const point of NexusSpatial.points(entry)) {
        if (n++ % stride) continue;
        const offset = point.index * 3, known = sent && sent.bytes.length >= offset + 3;
        ctx.beginPath(); ctx.arc(point.x * 3, point.y * 3, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = known ? 'rgb(' + [0, 1, 2].map(i => sent.bytes.charCodeAt(offset + i)).join(',') + ')' : '#151b23';
        ctx.fill(); ctx.strokeStyle = known ? '#ffffff90' : '#79828c'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    $('studio-live-note').textContent = dirty ? 'Atualizando posições nas luzes. Pontos: últimas cores enviadas ao controlador.'
      : !liveFrame.connected ? 'Controlador desconectado: saída dos LEDs indisponível. O fundo é somente a prévia do efeito.'
      : liveFrame.error ? 'Efeito pausado. Pontos: últimas cores enviadas pelos ajustes comuns; o fundo está parado.'
      : !liveFrame.power ? 'Luzes desligadas. Pontos: última cor enviada; o fundo continua mostrando a prévia do efeito.'
      : 'Fundo: prévia do efeito. Pontos: últimas cores enviadas' + (liveFrame.enabled ? ' aos LEDs do mapa.' : '; o mapa está desativado.') + ' Modos nativos não fornecem leitura por LED.';
  }
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
        const finish = () => { dragging = false; scheduleSave(); button.removeEventListener('pointermove', move); button.removeEventListener('pointerup', finish); button.removeEventListener('pointercancel', finish); };
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
  }
  function status() {
    $('studio-toggle').textContent = data.enabled ? 'Voltar ao controle comum' : 'Usar este efeito';
    $('studio-error').hidden = !data.error; $('studio-error').textContent = data.error || '';
    $('studio-state').textContent = data.error ? 'Efeito pausado' : data.enabled ? 'Mapa ao vivo' : 'Controle comum';
  }
  function renderLibrary() {
    const select = $('studio-effect'); select.replaceChildren();
    for (const effect of data.effects) { const option = make('option', effect.name); option.value = effect.id; select.append(option); }
    select.value = data.activeId; controls(); status();
    if (document.activeElement !== $('studio-profile-name')) $('studio-profile-name').value = data.effects.find(e => e.id === data.activeId)?.name.slice(0, 48) || '';
  }
  async function refresh(keepDraft = true) {
    if (!api || loading || document.hidden || !['studio', 'settings'].includes(current)) return;
    loading = true;
    try {
      const version = editVersion, next = await api('/api/studio');
      const old = data, changed = !old || old.activeId !== next.activeId || old.effects.length !== next.effects.length || JSON.stringify(old.values) !== JSON.stringify(next.values);
      const layoutChanged = !old || JSON.stringify(old.layout) !== JSON.stringify(next.layout);
      if (old && (!layoutChanged || ((dirty || saving || dragging || editVersion !== version) && keepDraft))) next.layout = old.layout;
      data = next;
      if (current === 'studio') {
        if (changed) { if (!dragging) { map(); selection(); } renderLibrary(); }
        else status();
        if (layoutChanged && !dirty && !dragging) { map(); selection(); }
      }
      const text = data.metrics.fps ? data.metrics.fps + ' FPS renderizados · ' + data.metrics.renderMs + ' ms/quadro · motor ' + data.metrics.memoryMB + ' MiB' : 'Motor em repouso';
      $('studio-metrics').textContent = text; $('settings-metrics').textContent = text;
    } catch (e) { error(e); } finally { loading = false; }
  }
  async function play(body) { const next = await request('/api/studio/play', body, 'POST'); if (next) { if (dirty || dragging) next.layout = data.layout; data = next; renderLibrary(); if (!dragging) { map(); selection(); } } }
  $('studio-effect').addEventListener('change', () => play({ activeId: $('studio-effect').value, enabled: true }));
  $('studio-toggle').addEventListener('click', () => play({ enabled: !data.enabled }));
  function parameters(event) {
    event.preventDefault(); const values = {};
    for (const input of $('studio-parameters').querySelectorAll('[data-key]')) values[input.dataset.key] = input.dataset.type === 'boolean' ? input.checked : input.dataset.type === 'number' ? Number(input.value) : input.value;
    play({ values, enabled: true });
  }
  $('studio-parameters').addEventListener('submit', parameters);
  $('studio-parameters').addEventListener('change', parameters);
  $('studio-retry').addEventListener('click', scheduleSave);
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
  $('studio-fan-split').addEventListener('click', () => {
    const value = item(), size = Number($('studio-fan-leds').value);
    if (!value || !Number.isInteger(size) || size < 1 || value.count % size || size > value.count) return toast('Use a quantidade real de LEDs por fan, que deve dividir a faixa selecionada sem sobrar LEDs.');
    const count = value.count / size;
    if (count + data.layout.length - 1 > 256) return toast('Limite de 256 posições no mapa.');
    const parts = Array.from({ length: count }, (_, n) => ({ ...value, key: n ? crypto.randomUUID() : value.key, name: value.name.slice(0, 45) + ' · fan ' + (n + 1), start: value.start + n * size, count: size, shape: 'fan', x: Math.min(0.94, value.x + (n % 4) * 0.15), y: Math.min(0.88, value.y + Math.floor(n / 4) * 0.24) }));
    data.layout = data.layout.flatMap(i => i === value ? parts : [i]); selected = parts[0].key; mark(); map(); selection();
  });
  async function importSource(source) {
    const result = await request('/api/studio/import', { source }, 'POST');
    if (result) { result.layout = data.layout; data = result; renderLibrary(); toast('Efeito adicionado à biblioteca. Escolha-o na lista para visualizar.'); }
  }
  $('studio-import').addEventListener('change', async event => {
    const input = event.target; input.disabled = true;
    try { for (const file of Array.from(input.files).slice(0, 32)) { if (file.size > 128 * 1024) { toast(file.name + ': limite de 128 KiB.'); continue; } await importSource(await file.text()); } } finally { input.value = ''; input.disabled = false; }
  });
  let formulaColors = ['#00f0ff', '#7954ff', '#ff0055'];
  function formulaSource() {
    const recipe = { format: 'nexus-effect/1', name: $('formula-name').value, pattern: $('formula-pattern').value, palette: formulaColors, speed: Number($('formula-speed').value), angle: Number($('formula-angle').value), scale: Number($('formula-scale').value) };
    $('studio-source').value = JSON.stringify(recipe, null, 2); $('formula-speed-label').value = recipe.speed + '%';
    $('formula-palette-preview').style.background = 'linear-gradient(90deg,' + (formulaColors.length === 1 ? [formulaColors[0], formulaColors[0]] : formulaColors).join(',') + ')';
  }
  function formulaPalette() {
    const container = $('formula-colors'); container.replaceChildren();
    formulaColors.forEach((value, i) => {
      const wrap = make('div', undefined, 'formula-color'), input = make('input'); input.type = 'color'; input.value = value; input.setAttribute('aria-label', 'Cor ' + (i + 1) + ' do efeito');
      input.addEventListener('input', () => { formulaColors[i] = input.value; formulaSource(); }); wrap.append(input);
      for (const [delta, text] of [[-1, '←'], [1, '→'], [0, '×']]) {
        const button = make('button', text); button.type = 'button'; button.setAttribute('aria-label', (delta ? 'Mover' : 'Remover') + ' cor ' + (i + 1) + (delta ? delta < 0 ? ' para esquerda' : ' para direita' : ''));
        button.disabled = delta ? i + delta < 0 || i + delta >= formulaColors.length : formulaColors.length === 1;
        button.addEventListener('click', () => { if (delta) [formulaColors[i], formulaColors[i + delta]] = [formulaColors[i + delta], formulaColors[i]]; else formulaColors.splice(i, 1); formulaPalette(); }); wrap.append(button);
      }
      container.append(wrap);
    });
    $('formula-add-color').disabled = formulaColors.length >= 8; formulaSource();
  }
  $('formula-add-color').addEventListener('click', () => { if (formulaColors.length < 8) { formulaColors.push('#ffffff'); formulaPalette(); } });
  for (const key of ['name', 'pattern', 'speed', 'angle', 'scale']) $('formula-' + key).addEventListener('input', formulaSource);
  $('studio-new').textContent = 'Criar efeito';
  $('studio-new').addEventListener('click', () => { $('formula-error').hidden = true; formulaPalette(); $('studio-formula-dialog').showModal(); $('formula-name').focus(); });
  $('studio-formula-close').addEventListener('click', () => $('studio-formula-dialog').close());
  $('studio-formula-form').addEventListener('submit', async event => {
    event.preventDefault(); $('formula-save').disabled = true; $('formula-error').hidden = true;
    try {
      const result = await api('/api/studio/import', { source: $('studio-source').value }, 'POST');
      result.layout = data.layout; data = result; renderLibrary();
      const effect = result.effects.find(e => e.id === result.id);
      if ($('formula-profile').checked) await api('/api/studio/profiles', { name: effect.name.slice(0, 48), activeId: effect.id, values: {} }, 'POST');
      $('studio-formula-dialog').close(); toast($('formula-profile').checked ? 'Efeito guardado na biblioteca e em Perfis.' : 'Efeito guardado na biblioteca.');
    } catch (e) { $('formula-error').textContent = e.message; $('formula-error').hidden = false; }
    finally { $('formula-save').disabled = false; }
  });
  $('studio-profile-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { const result = await request('/api/studio/profiles', { name: $('studio-profile-name').value, activeId: data.activeId, values: data.values }, 'POST'); if (result) toast('Efeito guardado na aba Perfis.'); }
    finally { button.disabled = false; }
  });
  $('studio-remove-effect').addEventListener('click', async () => { const result = await request('/api/studio/effects/' + data.activeId, undefined, 'DELETE'); if (result) { result.layout = data.layout; data = result; renderLibrary(); } });
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
      stream.onmessage = event => { try {
        const frame = JSON.parse(event.data); $('studio-preview').src = 'data:image/png;base64,' + frame.image; liveFrame = frame;
        // A frame can still use the preceding geometry while a new edit is
        // being sampled. It describes sent colors, never editable positions.
        drawOutput();
      } catch {} };
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
