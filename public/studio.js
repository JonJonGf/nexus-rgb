'use strict';
(() => {
  const T = window.NexusI18n;
  const $ = id => document.getElementById(id), make = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const effectNames = T.map({ static: 'Estático', rainbow: 'Arco-íris', wave: 'Onda', breathe: 'Respiração', pulse: 'Pulso', strobe: 'Estrobo', sequence: 'Sequência', comet: 'Cometa', scanner: 'Vai e vem', sparkle: 'Cintilação' });
  let api, toast, state, isAdmin = false, current = 'control', data, selected, dirty = false, fpsDirty = false, stream, poll, dragging = false, loading = false;
  const item = () => data?.layout.find(i => i.key === selected);
  let liveFrame, ports;
  function renderPorts() { if (ports) $('settings-ports').textContent = T('Painel TCP ') + ports.panel + ' · SDK TCP ' + ports.sdk + ' · Alexa TCP ' + ports.alexa + T(' · descoberta UDP 1900.'); }
  let inspector = 'device', libraryFilter = 'all', controlSignature = '', gallerySignature = '';
  function inspectorTab(name) {
    inspector = name;
    for (const key of ['device', 'effect']) { $('studio-tab-' + key).setAttribute('aria-selected', String(name === key)); $('studio-tab-' + key).tabIndex = name === key ? 0 : -1; $('studio-' + key + '-panel').hidden = name !== key; }
  }
  $('studio-tab-device').addEventListener('click', () => inspectorTab('device'));
  $('studio-tab-effect').addEventListener('click', () => inspectorTab('effect'));
  $('studio-edit-effect').addEventListener('click', () => inspectorTab('effect'));
  document.querySelector('.studio-inspector-tabs').addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return; e.preventDefault(); inspectorTab(e.key === 'Home' ? 'device' : e.key === 'End' ? 'effect' : inspector === 'device' ? 'effect' : 'device'); $('studio-tab-' + inspector).focus(); });
  inspectorTab('device');
  let editVersion = 0, savedVersion = 0, saving = false, saveTimer, lastSave = 0;
  function mark() { editVersion++; dirty = true; $('studio-dirty').textContent = dragging ? T('Solte para salvar a posição') : T('Salvando posição…'); $('studio-retry').hidden = true; scheduleSave(); drawOutput(); }
  function scheduleSave() {
    clearTimeout(saveTimer);
    if (saving || !dirty || dragging) return;
    // Keep dragging local; submit the final position on release. Coalesce
    // keyboard/inspector edits below the LAN API request budget as well.
    saveTimer = setTimeout(saveLayout, Math.max(0, lastSave + 350 - Date.now()));
  }
  async function saveLayout() {
    if (saving || !dirty || !isAdmin || dragging) return;
    saving = true; lastSave = Date.now(); const version = editVersion;
    try {
      const next = await api('/api/studio', { layout: structuredClone(data.layout) }, 'POST');
      savedVersion = version; dirty = editVersion !== savedVersion;
      // Buttons retain references to these items in their pointer handlers.
      // An acknowledgement must not swap them for detached JSON objects.
      next.layout = data.layout;
      data = next; status();
      $('studio-dirty').textContent = dirty ? dragging ? T('Solte para salvar a posição') : T('Salvando posição…') : T('Salvo automaticamente');
      $('studio-retry').hidden = true;
    } catch (e) {
      $('studio-dirty').textContent = T('Não foi possível salvar'); $('studio-retry').hidden = false; error(e);
      // Keep the local edit for an explicit retry; do not flood a failed API.
      return;
    } finally { saving = false; }
    if (dirty) scheduleSave();
  }
  function paintPiece(ctx, entry, bytes, stride) {
    if (!bytes) return;
    const width = entry.width * 960, height = entry.height * 600;
    ctx.save(); ctx.translate(entry.x * 960, entry.y * 600); ctx.rotate(entry.rotation * Math.PI / 180);
    for (let n = 0; n < entry.count; n += stride) {
      const offset = (entry.start + n) * 3; if (bytes.length < offset + 3) continue;
      const i = entry.reverse ? entry.count - 1 - n : n, group = Math.min(stride, entry.count - n);
      ctx.fillStyle = 'rgb(' + [0, 1, 2].map(channel => bytes.charCodeAt(offset + channel)).join(',') + ')';
      if (entry.shape === 'fan') {
        const start = (entry.reverse ? i - group + 0.5 : i - 0.5) / entry.count * Math.PI * 2 - Math.PI / 2, end = start + group / entry.count * Math.PI * 2;
        ctx.save(); ctx.scale(width, height); ctx.beginPath(); ctx.arc(0, 0, 0.49, start, end); ctx.arc(0, 0, 0.30, end, start, true); ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (entry.shape === 'matrix') {
        const rows = Math.ceil(entry.count / entry.columns);
        ctx.fillRect(((i % entry.columns) / entry.columns - 0.5) * width, (Math.floor(i / entry.columns) / rows - 0.5) * height, width / entry.columns, height / rows);
      } else {
        const start = (entry.reverse ? i - group + 1 : i) / entry.count - 0.5, size = group / entry.count;
        if (height > width) ctx.fillRect(-width * 0.4, start * height * 0.9, width * 0.8, size * height * 0.9 + 0.5);
        else ctx.fillRect(start * width * 0.9, -height * 0.4, size * width * 0.9 + 0.5, height * 0.8);
      }
    }
    ctx.restore();
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
      paintPiece(ctx, entry, sent?.bytes, stride);
      for (const point of NexusSpatial.points(entry)) {
        if (n++ % stride) continue;
        const offset = point.index * 3, known = sent && sent.bytes.length >= offset + 3;
        ctx.beginPath(); ctx.arc(point.x * 3, point.y * 3, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = known ? 'rgb(' + [0, 1, 2].map(i => sent.bytes.charCodeAt(offset + i)).join(',') + ')' : '#151b23';
        ctx.fill(); ctx.strokeStyle = known ? '#ffffff90' : '#79828c'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    const spatial = liveFrame.playback?.spatial ?? (liveFrame.enabled && !liveFrame.error);
    $('studio-current-effect').textContent = !liveFrame.connected ? T('Controlador desconectado') : !liveFrame.power ? T('Luzes apagadas') : spatial ? effectName(data?.effects.find(e => e.id === data.activeId)) || liveFrame.playback?.name || T('Efeito espacial') : effectNames[liveFrame.playback?.effect || state?.master.effect] || T('Ajustes dos componentes');
    $('studio-live-note').textContent = (!liveFrame.connected ? T('Saída indisponível: controlador desconectado. ') : !liveFrame.power ? T('Luzes desligadas. ') : liveFrame.error ? T('Efeito espacial pausado; mostrando a saída dos ajustes comuns. ') : spatial ? T('Fundo: campo espacial ativo. ') : T('Iluminação e Perfis: saída atual de cada componente. '))
      + T('Cores: últimos comandos enviados, sem leitura física. Modos nativos ficam sem cor por LED.')
      + (dirty ? dragging ? T(' Solte para salvar a posição.') : T(' Salvando posição…') : '');
  }
  function error(e) { toast?.(e.message || String(e)); }
  async function request(route, body, method) { try { return await api(route, body, method); } catch (e) { error(e); return null; } }
  function selection(force = false) {
    const value = item(); $('studio-device-form').hidden = !value;
    $('studio-selection-note').hidden = Boolean(value);
    if (!value || !force && $('studio-device-form').contains(document.activeElement)) return;
    for (const key of ['shape', 'rotation', 'count', 'columns']) $('studio-' + key).value = value[key];
    $('studio-item-name').value = value.name; $('studio-start').value = value.start + 1; $('studio-reverse').checked = value.reverse;
    for (const key of ['x', 'y', 'width', 'height']) $('studio-' + key).value = Math.round(value[key] * 1000) / 10;
    $('studio-rotation-label').textContent = value.rotation + '°';
    $('studio-piece-summary').textContent = value.count + ' LEDs · ' + (value.start + 1) + '–' + (value.start + value.count);
    $('studio-columns-field').hidden = value.shape !== 'matrix';
    document.querySelectorAll('.studio-shapes [data-shape]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.shape === value.shape)); b.disabled = !isAdmin; });
    $('studio-device-form').querySelectorAll('input,select,button').forEach(e => { e.disabled = !isAdmin; });
    $('studio-device-chips').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === selected)));
  }
  function position(button, value) { button.style.left = value.x * 100 + '%'; button.style.top = value.y * 100 + '%'; button.style.width = value.width * 100 + '%'; button.style.height = value.height * 100 + '%'; button.style.setProperty('--rotation', value.rotation + 'deg'); }
  function map() {
    if (!data) return;
    const container = $('studio-items'); container.replaceChildren(); $('studio-empty').hidden = Boolean(data.layout.length);
    for (const value of data.layout) {
      const button = make('button', undefined, 'studio-item' + (value.key === selected ? ' selected' : '')); button.type = 'button'; button.dataset.key = value.key; button.dataset.shape = value.shape; button.setAttribute('aria-label', T`Posicionar ${value.name}`); button.title = value.name + ' · LEDs ' + (value.start + 1) + '–' + (value.start + value.count); position(button, value);
      button.append(make('i'), make('span', value.name)); container.append(button);
      button.addEventListener('click', () => { selected = value.key; inspectorTab('device'); selection(true); container.querySelectorAll('.studio-item').forEach(b => b.classList.toggle('selected', b === button)); });
      button.addEventListener('pointerdown', event => {
        if (!isAdmin || event.button !== 0) return;
        event.preventDefault(); document.activeElement?.blur(); selected = value.key; dragging = true; inspectorTab('device'); selection(true); container.querySelectorAll('.studio-item').forEach(b => b.classList.toggle('selected', b === button)); button.setPointerCapture(event.pointerId);
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
    $('studio-map-summary').textContent = data.layout.length + T(' posições · ') + data.layout.reduce((n, i) => n + i.count, 0) + T(' LEDs mapeados');
    const chips = $('studio-device-chips'); chips.replaceChildren();
    for (const value of data.layout) { const chip = make('button', value.name); chip.type = 'button'; chip.dataset.key = value.key; chip.setAttribute('aria-pressed', String(value.key === selected)); chip.addEventListener('click', () => { selected = value.key; inspectorTab('device'); selection(); container.querySelectorAll('.studio-item').forEach(b => b.classList.toggle('selected', b.dataset.key === selected)); }); chips.append(chip); }
  }
  function controls() {
    const effect = data?.effects.find(e => e.id === data.activeId); if (!effect) return;
    $('studio-publisher').textContent = data.enabled ? effect.format === 'nexus-effect/1' ? T(effect.publisher) : effect.publisher : '';
    $('studio-effect-note').textContent = data.enabled ? (effect.warnings || []).map(warning => T(warning)).join(' ') : '';
    $('studio-remove-effect').hidden = !data.enabled || effect.builtin || !isAdmin;
    const form = $('studio-parameters'), signature = JSON.stringify([T.locale(), data.enabled, effect.id, effect.controls, data.values]);
    if (signature === controlSignature || form.contains(document.activeElement)) return;
    controlSignature = signature; form.replaceChildren();
    for (const control of data.enabled ? effect.controls : []) {
      const label = make('label', effect.builtin || effect.recipe ? T(control.label) : control.label); let input;
      if (control.type === 'combobox') { input = make('select'); for (const value of control.values) { const option = make('option', value); option.value = value; input.append(option); } }
      else { input = make('input'); input.type = control.type === 'boolean' ? 'checkbox' : control.type === 'color' ? 'color' : 'number'; if (control.type === 'number') { input.min = control.min; input.max = control.max; input.step = 'any'; } }
      input.dataset.key = control.key; input.dataset.type = control.type; input.setAttribute('aria-label', effect.builtin || effect.recipe ? T(control.label) : control.label);
      const value = data.values?.[control.key] ?? control.default; if (control.type === 'boolean') input.checked = value; else input.value = value;
      label.append(input); form.append(label);
    }
  }
  function status() {
    $('studio-toggle').hidden = !data.enabled;
    $('studio-common-adjust').hidden = Boolean(data.enabled);
    $('studio-profile-form').hidden = !isAdmin || !data.enabled;
    $('studio-effect-heading').textContent = data.enabled ? effectName(data.effects.find(e => e.id === data.activeId)) : effectNames[state?.master.effect] || '';
    $('studio-error').hidden = !data.error; $('studio-error').textContent = T(data.error || '');
    $('studio-state').textContent = data.error ? T('Efeito pausado') : data.enabled ? T('Mapa ao vivo') : T('Controle comum');
    controls();
  }
  async function sharedPlay(route, body) {
    const next = await request(route, body, 'POST');
    if (next) { state = next; await refresh(); renderLibrary(); }
    return Boolean(next);
  }
  function renderLibrary() {
    if (!data || !state) return;
    status(); renderGallery();
    if (document.activeElement !== $('studio-profile-name')) $('studio-profile-name').value = data.effects.find(e => e.id === data.activeId)?.name.slice(0, 48) || '';
  }
  function effectName(effect) { return effect ? effect.builtin ? T(effect.name) : effect.name : ''; }
  function renderGallery(force = false) {
    if (!data || !state) return;
    if (!force && !$('studio-picker-dialog').open) return;
    const cards = [
      ...(state.profiles || []).map(p => ({ kind: 'profile', id: p.id, name: p.name, note: p.spatial ? T('Usa a posição no mapa') : T('Seu perfil salvo'), palette: p.settings?.palette || [p.color] })),
      ...(state.presets || []).map(p => ({ kind: 'preset', id: p.id, name: T(p.name), note: T(p.description), palette: p.colors })),
      ...Object.entries(effectNames).map(([id, name]) => ({ kind: 'motion', id, name, note: T('Segue a sequência de cada componente'), palette: state.master.palette || [state.master.color] })),
      ...data.effects.map(e => ({ kind: 'spatial', id: e.id, name: effectName(e), note: T('Usa a posição no mapa'), palette: e.palette || (e.controls || []).filter(c => c.type === 'color').map(c => data.values?.[c.key] || c.default) }))
    ];
    const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const query = norm($('studio-library-search').value.trim()), grid = $('studio-library');
    const signature = JSON.stringify([T.locale(), libraryFilter, query, cards, data.enabled, data.activeId, state.master.effect]);
    if (!force && signature === gallerySignature) return;
    gallerySignature = signature; grid.replaceChildren();
    for (const card of cards.filter(c => (libraryFilter === 'all' || (libraryFilter === 'ready' ? ['preset', 'motion'].includes(c.kind) : libraryFilter === c.kind)) && norm(c.name).includes(query))) {
      const button = make('button', undefined, 'library-card'); button.type = 'button'; button.dataset.kind = card.kind; button.dataset.id = card.id;
      const colors = card.palette.filter(c => /^#[a-f0-9]{6}$/i.test(c));
      button.style.setProperty('--card-palette', 'linear-gradient(120deg,' + (colors.length > 1 ? colors : [colors[0] || '#7954ff', colors[0] || '#00c8ff']).join(',') + ')');
      const active = card.kind === 'spatial' ? data.enabled && card.id === data.activeId : card.kind === 'motion' ? !data.enabled && card.id === state.master.effect : false;
      button.classList.toggle('active', Boolean(active)); button.setAttribute('aria-pressed', String(Boolean(active)));
      button.append(make('span', undefined, 'library-art'), make('small', { profile: T('PERFIL'), preset: T('CENA'), motion: T('MOVIMENTO'), spatial: T('MAPA') }[card.kind]), make('strong', card.name), make('span', card.note, 'library-note'));
      button.addEventListener('click', async () => {
        button.disabled = true;
        if (card.kind === 'motion' && card.id === 'strobe') toast(T('Estrobo produz flashes. Evite em caso de sensibilidade à luz intermitente.'));
        const ok = card.kind === 'spatial' ? await play({ activeId: card.id, enabled: true }) : await sharedPlay(card.kind === 'motion' ? '/api/control' : '/api/' + (card.kind === 'profile' ? 'profiles/' : 'presets/') + card.id, card.kind === 'motion' ? { effect: card.id } : {});
        if (ok) $('studio-picker-dialog').close(); else button.disabled = false;
      });
      grid.append(button);
    }
    $('studio-library-empty').hidden = Boolean(grid.childElementCount);
  }
  $('studio-choose').addEventListener('click', () => { renderGallery(true); $('studio-picker-dialog').showModal(); $('studio-library-search').focus(); });
  $('studio-picker-close').addEventListener('click', () => $('studio-picker-dialog').close());
  $('studio-library-search').addEventListener('input', () => renderGallery());
  document.querySelectorAll('[data-library]').forEach(b => b.addEventListener('click', () => { libraryFilter = b.dataset.library; document.querySelectorAll('[data-library]').forEach(e => e.setAttribute('aria-pressed', String(e === b))); renderGallery(); }));
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
      const text = data.metrics.fps ? data.metrics.fps + T(' FPS renderizados · ') + data.metrics.renderMs + T(' ms/quadro · motor ') + data.metrics.memoryMB + ' MiB' : T('Motor em repouso');
      $('studio-metrics').textContent = text; $('settings-metrics').textContent = text;
    } catch (e) { error(e); } finally { loading = false; }
  }
  async function play(body) { const next = await request('/api/studio/play', body, 'POST'); if (next) { if (dirty || dragging) next.layout = data.layout; data = next; renderLibrary(); if (!dragging) { map(); selection(); } } return Boolean(next); }
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
  function editPiece(field) {
    const value = item(); if (!value) return;
    // Change only the edited property: rounded display values must not move
    // a component when the user merely renames it or changes its shape.
    if (field === 'item-name') value.name = $('studio-item-name').value;
    else if (['rotation', 'count', 'columns'].includes(field)) value[field] = Number($('studio-' + field).value);
    else if (['x', 'y', 'width', 'height'].includes(field)) value[field] = Number($('studio-' + field).value) / 100;
    else if (field === 'start') value.start = Number($('studio-start').value) - 1;
    else if (field === 'shape') value.shape = $('studio-shape').value;
    else if (field === 'reverse') value.reverse = $('studio-reverse').checked;
    else return;
    const button = [...$('studio-items').children].find(e => e.dataset.key === value.key);
    if (button) { position(button, value); button.dataset.shape = value.shape; button.querySelector('span').textContent = value.name; button.setAttribute('aria-label', T`Posicionar ${value.name}`); button.title = value.name + ' · LEDs ' + (value.start + 1) + '–' + (value.start + value.count); }
    const chip = [...$('studio-device-chips').children].find(e => e.dataset.key === value.key); if (chip) chip.textContent = value.name;
    mark(); selection(true);
  }
  $('studio-device-form').addEventListener('change', e => editPiece(e.target.id.slice(7)));
  document.querySelectorAll('.studio-shapes [data-shape]').forEach(b => b.addEventListener('click', () => { $('studio-shape').value = b.dataset.shape; editPiece('shape'); }));
  $('studio-rotate').addEventListener('click', () => { $('studio-rotation').value = (Number($('studio-rotation').value) + 90) % 360; editPiece('rotation'); });
  $('studio-rotation').addEventListener('input', () => { $('studio-rotation-label').textContent = $('studio-rotation').value + '°'; });
  $('studio-split').addEventListener('click', () => {
    const value = item(); if (!value || value.count < 2) return toast(T('Este componente não tem LEDs suficientes para dividir.'));
    const first = Math.floor(value.count / 2), second = { ...value, key: crypto.randomUUID(), start: value.start + first, count: value.count - first, x: Math.min(0.94, value.x + 0.14), name: value.name.slice(0, 48) + ' · 2' };
    value.count = first; data.layout.push(second); selected = second.key; mark(); map(); selection();
  });
  $('studio-merge').addEventListener('click', () => {
    const value = item(), other = value && data.layout.find(i => i.key !== value.key && i.deviceId === value.deviceId && (i.start + i.count === value.start || value.start + value.count === i.start));
    if (!other) return toast(T('Selecione uma divisão com faixa de LEDs vizinha.'));
    value.start = Math.min(value.start, other.start); value.count += other.count; data.layout = data.layout.filter(i => i !== other); mark(); map(); selection();
  });
  $('studio-fan-split').addEventListener('click', () => {
    const value = item(), size = Number($('studio-fan-leds').value);
    if (!value || !Number.isInteger(size) || size < 1 || value.count % size || size > value.count) return toast(T('Use a quantidade real de LEDs por fan, que deve dividir a faixa selecionada sem sobrar LEDs.'));
    const count = value.count / size;
    if (count + data.layout.length - 1 > 256) return toast(T('Limite de 256 posições no mapa.'));
    const parts = Array.from({ length: count }, (_, n) => ({ ...value, key: n ? crypto.randomUUID() : value.key, name: value.name.slice(0, 45) + ' · fan ' + (n + 1), start: value.start + n * size, count: size, shape: 'fan', x: Math.min(0.94, value.x + (n % 4) * 0.15), y: Math.min(0.88, value.y + Math.floor(n / 4) * 0.24) }));
    data.layout = data.layout.flatMap(i => i === value ? parts : [i]); selected = parts[0].key; mark(); map(); selection();
  });
  async function importSource(source) {
    const result = await request('/api/studio/import', { source }, 'POST');
    if (result) { result.layout = data.layout; data = result; renderLibrary(); toast(T('Efeito adicionado à biblioteca. Escolha-o na lista para visualizar.')); }
  }
  $('studio-import').addEventListener('change', async event => {
    const input = event.target; input.disabled = true;
    try { for (const file of Array.from(input.files).slice(0, 32)) { if (file.size > 128 * 1024) { toast(file.name + T(': limite de 128 KiB.')); continue; } await importSource(await file.text()); } } finally { input.value = ''; input.disabled = false; }
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
      const wrap = make('div', undefined, 'formula-color'), input = make('input'); input.type = 'color'; input.value = value; input.setAttribute('aria-label', T`Cor ${i + 1} do efeito`);
      input.addEventListener('input', () => { formulaColors[i] = input.value; formulaSource(); }); wrap.append(input);
      for (const [delta, text] of [[-1, '←'], [1, '→'], [0, '×']]) {
        const button = make('button', text); button.type = 'button'; button.setAttribute('aria-label', (delta ? T('Mover') : T('Remover')) + T(' cor ') + (i + 1) + (delta ? delta < 0 ? T(' para esquerda') : T(' para direita') : ''));
        button.disabled = delta ? i + delta < 0 || i + delta >= formulaColors.length : formulaColors.length === 1;
        button.addEventListener('click', () => { if (delta) [formulaColors[i], formulaColors[i + delta]] = [formulaColors[i + delta], formulaColors[i]]; else formulaColors.splice(i, 1); formulaPalette(); }); wrap.append(button);
      }
      container.append(wrap);
    });
    $('formula-add-color').disabled = formulaColors.length >= 8; formulaSource();
  }
  $('formula-add-color').addEventListener('click', () => { if (formulaColors.length < 8) { formulaColors.push('#ffffff'); formulaPalette(); } });
  for (const key of ['name', 'pattern', 'speed', 'angle', 'scale']) $('formula-' + key).addEventListener('input', formulaSource);
  $('studio-new').addEventListener('click', () => { $('studio-picker-dialog').close(); $('formula-error').hidden = true; formulaPalette(); $('studio-formula-dialog').showModal(); $('formula-name').focus(); });
  $('studio-formula-close').addEventListener('click', () => $('studio-formula-dialog').close());
  $('studio-formula-form').addEventListener('submit', async event => {
    event.preventDefault(); $('formula-save').disabled = true; $('formula-error').hidden = true;
    try {
      const result = await api('/api/studio/import', { source: $('studio-source').value }, 'POST');
      result.layout = data.layout; data = result; renderLibrary();
      const effect = result.effects.find(e => e.id === result.id);
      if ($('formula-profile').checked) await api('/api/studio/profiles', { name: effect.name.slice(0, 48), activeId: effect.id, values: {} }, 'POST');
      $('studio-formula-dialog').close(); toast($('formula-profile').checked ? T('Efeito guardado na biblioteca e em Perfis.') : T('Efeito guardado na biblioteca.'));
    } catch (e) { $('formula-error').textContent = T(e.message); $('formula-error').hidden = false; }
    finally { $('formula-save').disabled = false; }
  });
  $('studio-profile-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { const result = await request('/api/studio/profiles', { name: $('studio-profile-name').value, activeId: data.activeId, values: data.values }, 'POST'); if (result) toast(T('Efeito guardado na aba Perfis.')); }
    finally { button.disabled = false; }
  });
  $('studio-remove-effect').addEventListener('click', async () => { const result = await request('/api/studio/effects/' + data.activeId, undefined, 'DELETE'); if (result) { result.layout = data.layout; data = result; renderLibrary(); } });
  function fpsLabel() { const fps = Number($('settings-fps').value); $('settings-fps-label').textContent = fps + ' FPS'; document.querySelectorAll('[data-fps]').forEach(b => b.classList.toggle('active', Number(b.dataset.fps) === fps)); }
  $('settings-fps').addEventListener('input', () => { fpsDirty = true; fpsLabel(); });
  document.querySelectorAll('[data-fps]').forEach(button => button.addEventListener('click', () => { fpsDirty = true; $('settings-fps').value = button.dataset.fps; fpsLabel(); }));
  $('settings-fps-form').addEventListener('submit', async event => { event.preventDefault(); const result = await request('/api/settings', { fps: Number($('settings-fps').value) }, 'POST'); if (result) { fpsDirty = false; $('settings-fps').value = result.performance.fps; fpsLabel(); toast(T('Taxa salva. Os efeitos usam o novo limite sem reiniciar o controlador.')); } });
  function open(name) {
    current = name; clearInterval(poll); stream?.close(); stream = null;
    if (!api || !['studio', 'settings'].includes(name) || document.hidden) return;
    refresh();
    poll = setInterval(refresh, 3000);
    if (name === 'studio') {
      liveFrame = null; $('studio-preview').hidden = true; $('studio-preview').removeAttribute('src'); drawOutput();
      $('studio-current-effect').textContent = T('Aguardando saída');
      stream = new EventSource('/api/studio/preview');
      stream.onmessage = event => { try {
        const frame = JSON.parse(event.data), image = $('studio-preview'); liveFrame = frame;
        image.hidden = !frame.image || !frame.enabled || !frame.power || !frame.connected || Boolean(frame.error);
        if (!image.hidden) image.src = 'data:image/png;base64,' + frame.image;
        else image.removeAttribute('src');
        // A frame can still use the preceding geometry while a new edit is
        // being sampled. It describes sent colors, never editable positions.
        drawOutput();
      } catch {} };
    } else if (isAdmin) api('/api/network').then(n => { ports = n.ports; renderPorts(); }).catch(error);
  }
  window.addEventListener('nexus:languagechange', () => {
    if (data) { status(); renderGallery(); map(); selection(); if (liveFrame) drawOutput(); }
    $('studio-dirty').textContent = !$('studio-retry').hidden ? T('Não foi possível salvar') : dirty ? dragging ? T('Solte para salvar a posição') : T('Salvando posição…') : T('Salvo automaticamente');
    renderPorts();
    // Translating palette buttons must not replace an advanced JSON draft.
    const source = $('studio-source').value; formulaPalette(); $('studio-source').value = source;
  });
  document.addEventListener('visibilitychange', () => open(current));
  window.addEventListener('pagehide', () => { clearInterval(poll); stream?.close(); stream = null; });
  window.NexusStudio = {
    open,
    update(next, admin, requestApi, showToast, page) {
      const first = !api; state = next; isAdmin = admin; api = requestApi; toast = showToast;
      renderGallery();
      document.querySelectorAll('.studio-admin').forEach(e => { if (!e.closest('#studio-formula-form')) e.hidden = !admin; }); $('settings-fps-save').disabled = !admin; $('settings-fps').disabled = !admin;
      document.querySelectorAll('[data-fps]').forEach(e => { e.disabled = !admin; }); $('settings-admin-note').hidden = admin;
      if (!fpsDirty && document.activeElement !== $('settings-fps')) { $('settings-fps').value = next.performance?.fps || 20; fpsLabel(); }
      $('studio-readonly-note').hidden = admin; if (data) status(); selection();
      if (first) open(page);
    }
  };
})();
