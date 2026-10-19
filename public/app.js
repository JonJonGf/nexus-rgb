'use strict';
(() => {
  const T = window.NexusI18n;
  const $ = id => document.getElementById(id);
  const labels = T.map({ static: 'Estático', rainbow: 'Arco-íris', wave: 'Onda', breathe: 'Respiração', pulse: 'Pulso', strobe: 'Estrobo', sequence: 'Sequência', comet: 'Cometa', scanner: 'Vai e vem', sparkle: 'Cintilação' });
  const descriptions = T.map({ static: 'Uma cor contínua', rainbow: 'Cores em movimento', wave: 'Cor percorre os LEDs', breathe: 'Brilho sobe e desce', pulse: 'Pulsos de luz', strobe: 'Flashes de luz', sequence: 'Uma cor por vez, na ordem escolhida', comet: 'Uma luz percorre os LEDs deixando uma cauda', scanner: 'Um feixe de luz percorre os LEDs e volta', sparkle: 'Pontos de luz cintilam pela sequência de LEDs' });
  const mainEffects = ['static', 'rainbow', 'wave', 'breathe', 'pulse', 'strobe'];
  let state = null, admin = false, currentPage = 'control', events = null, networkInfo = null, mobileLink = '', loading = false, toastTimer;
  let sessionRefresh = null, initializing = false, reconnectTimer = null, reconnectDelay = 3000;
  const onThisPC = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const controls = ['power', 'color', 'hex', 'brightness', 'speed'];
  const el = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true');
    const paths = { static: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M16 10a6 6 0 1 0 0 12 6 6 0 1 0 0-12'], wave: ['M2 11c5-9 9-9 14 0s9 9 14 0', 'M2 21c5-9 9-9 14 0s9 9 14 0'], rainbow: ['M3 25a13 13 0 0 1 26 0', 'M8 25a8 8 0 0 1 16 0', 'M13 25a3 3 0 0 1 6 0'], breathe: ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M16 9a7 7 0 1 0 0 14 7 7 0 1 0 0-14', 'M16 14a2 2 0 1 0 0 4 2 2 0 1 0 0-4'], pulse: ['M2 16h6l4-11 7 22 5-11h6'], native: ['M4 5h24v18H4Z', 'M11 28h10m-5-5v5'], ram: ['M2 8h28v15H2Z', 'M6 12h4v6H6Zm8 0h4v6h-4Zm8 0h4v6h-4Z', 'M5 23v4m4-4v4m4-4v4m6-4v4m4-4v4m4-4v4'], board: ['M3 3h26v26H3Z', 'M8 7h10v10H8Z', 'M22 6v12m3-12v12M8 22h17M8 26h13'], rgb: ['M16 4a12 12 0 1 0 0 24 12 12 0 1 0 0-24', 'M16 11a5 5 0 1 0 0 10 5 5 0 1 0 0-10', 'M16 4v7m12 5h-7m-5 12v-7M4 16h7'] };
    paths.strobe = ['m18 2-13 17h10l-1 11 13-17H17Z'];
    paths.keyboard = ['M2 8h28v16H2Z', 'M5 12h2v2H5Zm4 0h2v2H9Zm4 0h2v2h-2Zm4 0h2v2h-2Zm4 0h2v2h-2Zm4 0h2v2h-2ZM5 16h2v2H5Zm4 0h2v2H9Zm4 0h6v2h-6Zm8 0h2v2h-2Zm4 0h2v2h-2Z'];
    paths.mouse = ['M11 3h10a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z', 'M16 3v9', 'M6 12h20'];
    paths.gpu = ['M2 9h28v14H2Z', 'M5 13h5v6H5Zm8 0h5v6h-5Zm8 0h5v6h-5Z', 'M2 11H0v10h2'];
    paths.cooler = ['M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26', 'M16 11a5 5 0 1 0 0 10 5 5 0 1 0 0-10', 'M16 11V3m5 13h8M16 21v8M11 16H3'];
    paths.strip = ['M2 13h28v6H2Z', 'M6 16a1 1 0 1 0 0 .1m6-.1a1 1 0 1 0 0 .1m6-.1a1 1 0 1 0 0 .1m6-.1a1 1 0 1 0 0 .1'];
    for (const d of paths[name] || paths.rgb) { const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); } return svg;
  }
  function deviceTypeLabel(d) {
    if (d.kind === 'argb') return 'ARGB';
    if (d.kind === 'port') return T('PORTA RGB');
    switch (d.type) {
      case 0: return T('PLACA-MÃE');
      case 1: return 'RAM';
      case 2: return T('PLACA DE VÍDEO');
      case 3: return 'COOLER';
      case 4: return T('FITA LED');
      case 5: return T('TECLADO');
      case 6: return 'MOUSE';
      case 7: return 'MOUSEPAD';
      case 8: return 'HEADSET';
      default: return 'RGB';
    }
  }
  function deviceIconName(d) {
    if (d.kind === 'argb' || d.kind === 'port') return 'rgb';
    switch (d.type) {
      case 0: return 'board';
      case 1: return 'ram';
      case 2: return 'gpu';
      case 3: return 'cooler';
      case 4: return 'strip';
      case 5: return 'keyboard';
      case 6: case 7: return 'mouse';
      default: return 'rgb';
    }
  }
  function channels(hex) { return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)); }
  function theme(hex) {
    const original = channels(hex); let accent = original;
    const luminance = values => values.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
    for (let amount = .08; luminance(accent) < .2 && amount <= 1; amount += .08) accent = original.map(v => Math.round(v + (255 - v) * amount));
    document.documentElement.style.setProperty('--color', hex); document.documentElement.style.setProperty('--accent', `rgb(${accent.join(',')})`);
    $('preview-hex').textContent = hex.toUpperCase();
    document.querySelectorAll('.swatch').forEach(button => button.classList.toggle('selected', button.dataset.color === hex.toLowerCase()));
    const hsv = hexToHsv(hex); $('wheel-cursor').style.left = `${50 + Math.cos(hsv.h * Math.PI * 2) * hsv.s * 48}%`; $('wheel-cursor').style.top = `${50 + Math.sin(hsv.h * Math.PI * 2) * hsv.s * 48}%`;
    $('color-wheel').setAttribute('aria-valuenow', String(Math.round(hsv.h * 359))); $('color-wheel').setAttribute('aria-valuetext', hex.toUpperCase());
  }
  function hexToHsv(hex) {
    const [r, g, b] = channels(hex).map(v => v / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const hue = !delta ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return { h: hue / 6, s: max ? delta / max : 0 };
  }
  function wheelRgb(h, s) {
    const x = ((h % 1 + 1) % 1) * 6, f = x % 1, p = 1 - s, q = 1 - f * s, t = 1 - (1 - f) * s;
    return [[1, t, p], [q, 1, p], [p, 1, t], [p, q, 1], [t, p, 1], [1, p, q]][Math.floor(x)].map(v => Math.round(v * 255));
  }
  const wheel = $('color-wheel'), context = wheel.getContext('2d'), spectrum = context.createImageData(320, 320);
  for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) { const dx = x - 160, dy = y - 160, saturation = Math.hypot(dx, dy) / 154, offset = (y * 320 + x) * 4; if (saturation > 1) continue; spectrum.data.set([...wheelRgb(Math.atan2(dy, dx) / (2 * Math.PI), saturation), 255], offset); }
  context.putImageData(spectrum, 0, 0); let dragging = false, activePointer = null, wheelColor = '#00f0ff';
  new ResizeObserver(([entry]) => { const size = Math.max(65, Math.min(entry.contentRect.width - 20, entry.contentRect.height - 20, 320)); $('orb').style.width = `${size}px`; $('orb').style.height = `${size}px`; }).observe(document.querySelector('.wheel-zone'));
  function previewColor(hex) { wheelColor = hex; $('color').value = hex; $('hex').value = hex.toUpperCase(); theme(hex); }
  function pickColor(event) { const rect = wheel.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width - .5, y = (event.clientY - rect.top) / rect.height - .5; const value = wheelRgb(Math.atan2(y, x) / (2 * Math.PI), Math.min(1, Math.hypot(x, y) / .48)); previewColor('#' + value.map(v => v.toString(16).padStart(2, '0')).join('')); }
  function endWheelDrag() { const pointer = activePointer; dragging = false; activePointer = null; if (pointer !== null && wheel.hasPointerCapture(pointer)) wheel.releasePointerCapture(pointer); }
  function cancelWheelDrag(event) { if (event.pointerId !== activePointer) return; endWheelDrag(); if (state) previewColor(state.master.color); }
  wheel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || dragging || wheel.getAttribute('aria-disabled') === 'true') return;
    // Own the gesture so the browser cannot select or drag the surrounding page.
    event.preventDefault(); window.getSelection()?.removeAllRanges();
    activePointer = event.pointerId; dragging = true; wheel.setPointerCapture(activePointer); wheel.focus({ preventScroll: true }); pickColor(event);
  });
  wheel.addEventListener('pointermove', event => { if (event.pointerId === activePointer) { event.preventDefault(); pickColor(event); } });
  wheel.addEventListener('pointerup', event => { if (event.pointerId !== activePointer) return; event.preventDefault(); pickColor(event); endWheelDrag(); action('/api/control', { color: wheelColor, effect: 'static' }); });
  wheel.addEventListener('pointercancel', cancelWheelDrag);
  wheel.addEventListener('lostpointercapture', cancelWheelDrag);
  $('orb').addEventListener('dragstart', event => event.preventDefault());
  wheel.addEventListener('keydown', event => { if (!event.key.startsWith('Arrow') || wheel.getAttribute('aria-disabled') === 'true') return; event.preventDefault(); const hsv = hexToHsv($('color').value); if (event.key === 'ArrowRight') hsv.h += 1 / 72; if (event.key === 'ArrowLeft') hsv.h -= 1 / 72; if (event.key === 'ArrowUp') hsv.s = Math.min(1, hsv.s + .05); if (event.key === 'ArrowDown') hsv.s = Math.max(0, hsv.s - .05); previewColor('#' + wheelRgb(hsv.h, hsv.s).map(v => v.toString(16).padStart(2, '0')).join('')); action('/api/control', { color: wheelColor, effect: 'static' }); });
  function toast(message) { $('toast').textContent = T(message); $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000); }
  async function api(route, body, method = body === undefined ? 'GET' : 'POST', retrySession = true) {
    const response = await fetch(route, { method, credentials: 'same-origin', headers: { 'X-Nexus-Client': 'web', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401 && onThisPC && retrySession && route !== '/api/session/local') {
      // Sessions live only in the service process and expire after eight hours.
      // A LAN client keeps its existing access and never calls the PC-only route.
      sessionRefresh ??= api('/api/session/local', {}, 'POST', false).finally(() => { sessionRefresh = null; });
      await sessionRefresh;
      return api(route, body, method, false);
    }
    const data = await response.json(); if (!response.ok) throw Object.assign(new Error(T(data.error) || T('Não foi possível concluir.')), { status: response.status }); return data;
  }
  async function action(route, body, method) { try { const data = await api(route, body, method); if (data.master) render(data); return data; } catch (error) { toast(error.message); return null; } }
  function enable(value) { controls.forEach(id => { $(id).disabled = !value; }); wheel.setAttribute('aria-disabled', String(!value)); document.querySelectorAll('.effect,.swatch,.quick-preset').forEach(b => { b.disabled = !value; }); }
  function page(name) {
    currentPage = name;
    document.querySelectorAll('[data-view]').forEach(view => view.classList.toggle('active', view.dataset.view === name));
    document.querySelectorAll('.nav').forEach(button => button.classList.toggle('active', button.dataset.page === name));
    $('page-title').textContent = { control: T('Iluminação'), devices: T('Dispositivos'), profiles: T('Perfis'), connect: T('Conexões'), studio: T('Mapa do setup'), settings: T('Configurações') }[name];
    window.NexusStudio?.open(name);
    if (name === 'settings') api('/api/about').then(build=>{$('settings-build').textContent=(build.tag||T('Desenvolvimento'))+' · '+(build.commit?.slice(0,12)||build.version);}).catch(error=>toast(error.message));
    if (name === 'connect' && admin) loadNetwork();
  }
  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => page(button.dataset.page)));
  $('open-connect').addEventListener('click', () => page('connect'));
  for (const effect of mainEffects) {
    const name = labels[effect];
    const button = el('button', 'effect'); button.dataset.effect = effect; button.setAttribute('aria-pressed', 'false'); const symbol = el('span', 'symbol'); symbol.append(icon(effect)); button.append(symbol, el('span', 'effect-name', name), el('small', '', descriptions[effect]));
    button.addEventListener('click', () => { if (effect === 'strobe') toast(T('Estrobo produz flashes. Evite em caso de sensibilidade à luz intermitente.')); action('/api/control', { effect }); }); $('effects').append(button);
  }
  for (const color of ['#00f0ff', '#0094ff', '#7954ff', '#bd00ff', '#ff0055', '#ff8000', '#ffdf00', '#00ff88', '#ffffff']) {
    const button = el('button', 'swatch'); button.dataset.color = color; button.style.setProperty('--swatch', color); button.setAttribute('aria-label', T`Usar cor ${color}`);
    button.addEventListener('click', () => action('/api/control', { color, effect: 'static' })); $('swatches').append(button);
  }
  $('power').addEventListener('change', event => action('/api/control', { power: event.target.checked }));
  $('color').addEventListener('input', event => previewColor(event.target.value));
  $('color').addEventListener('change', event => action('/api/control', { color: event.target.value, effect: 'static' }));
  $('hex').addEventListener('change', event => {
    const color = event.target.value;
    if (!/^#[a-f0-9]{6}$/i.test(color)) { toast(T('Use uma cor no formato #RRGGBB.')); return; }
    action('/api/control', { color, effect: 'static' });
  });
  for (const field of ['brightness', 'speed']) {
    $(field).addEventListener('input', event => { $(`${field}-label`).textContent = `${event.target.value}%`; });
    $(field).addEventListener('change', event => action('/api/control', { [field]: Number(event.target.value) }));
  }
  function empty(container, text) { const message = el('div', 'empty', text); container.append(message); }
  function render(next) {
    state = next; enable(true); $('version').textContent = `Nexus RGB v${state.version}`;
    const master = state.master; const devices = state.hardware.devices;
    for (const field of controls) if (document.activeElement !== $(field) && !(dragging && ['color', 'hex'].includes(field))) { if (field === 'power') $(field).checked = master.power; else $(field).value = field === 'hex' ? master.color.toUpperCase() : master[field]; }
    if (!dragging) theme(master.color);
    $('preview-effect').textContent = master.power ? labels[master.effect] : T('Luzes apagadas');
    $('orb').classList.toggle('off', !master.power); $('orb').classList.toggle('animated', master.power && master.effect !== 'static'); $('orb').dataset.effect = master.effect;
    $('summary-power').textContent = master.power ? T('Ligada') : T('Desligada'); $('summary-brightness').textContent = `${master.brightness}%`; $('summary-devices').textContent = devices.filter(d => d.status === 'online').length;
    $('brightness-label').textContent = `${master.brightness}%`; $('speed-label').textContent = `${master.speed}%`;
    document.querySelectorAll('.effect').forEach(b => { b.classList.toggle('active', b.dataset.effect === master.effect); b.setAttribute('aria-pressed', String(b.dataset.effect === master.effect)); });
    const online = state.hardware.connected, detecting = Boolean(online && state.hardware.detecting), hung = Boolean(state.hardware.controllerHung);
    $('connection').textContent = !online ? (hung ? T('● OpenRGB sem resposta') : T('● Aguardando hardware')) : detecting ? T('● Detectando componentes…') : T('● Controlador conectado'); $('connection').className = `badge ${online ? 'online' : 'offline'}`;
    $('device-count').textContent = devices.length; $('hardware-summary').textContent = online ? `${devices.length} componentes · ${state.hardware.controllerCount ?? devices.length} controladoras` : (hung ? T('OpenRGB não respondeu ao consultar um componente') : T('Controlador RGB desconectado'));
    const failures = devices.filter(d => d.error);
    const notice = !online
      ? (hung
        ? (admin
          ? T('OpenRGB não respondeu ao consultar um componente.')
          : T('OpenRGB não respondeu ao consultar um componente. Reinicie o controlador no aplicativo do PC.'))
        : T('O controlador RGB ainda não está conectado. As configurações serão aplicadas quando ele ficar disponível. ') + T(state.hardware.error || ''))
      : detecting ? (devices.length ? T`Detectando componentes RGB (${devices.length} encontrado(s) até agora). Outras peças podem aparecer em instantes.` : T('Painel pronto. Detectando componentes RGB no controlador…')) : !devices.length ? T('Nenhum dispositivo RGB foi detectado. Confira a compatibilidade, feche outros programas RGB e verifique a instalação do driver.') : failures.length ? T`${failures.length} dispositivo(s) não conseguiu(ram) aplicar o ajuste. Consulte a aba Dispositivos.` : '';
    if (!online && hung && admin) {
      $('notice').replaceChildren();
      const text = el('span', '', T('OpenRGB não respondeu ao consultar um componente. '));
      const link = el('a', 'button subtle restart-controller-btn', T('Reiniciar controlador'));
      link.href = 'nexusrgb://restart';
      link.style.display = 'inline-block';
      link.style.marginLeft = '8px';
      link.style.verticalAlign = 'middle';
      $('notice').append(text, link);
      $('notice').hidden = false;
    } else {
      $('notice').textContent = notice;
      $('notice').hidden = !notice;
    }
    renderMini(devices); renderDevices(devices); renderProfiles(); renderPresets();
    window.NexusStudio?.update(state, admin, api, toast, currentPage);
    $('save-profile').hidden = !admin; $('create-profile').hidden = !admin; $('admin-connections').hidden = !admin; $('phone-connections').hidden = admin;
    if (!admin) $('profile-form').hidden = true;
    $('current-link').href = location.origin + '/'; $('current-link').textContent = location.origin + '/';
    if (state.alexa) { $('alexa-enabled').checked = Boolean(state.alexa.enabled); $('alexa-status').textContent = T(state.alexa.status || ''); }
  }
  function renderMini(devices) {
    const container = $('hardware-mini'); container.replaceChildren();
    container.style.setProperty('--component-count', Math.min(devices.length || 1, 6));
    if (!devices.length) return empty(container, T(state.hardware.connected && state.hardware.detecting ? 'Detectando componentes RGB. Suas peças aparecerão aqui em instantes.' : 'Aguardando o controlador. Seus componentes aparecerão aqui.'));
    for (const d of devices.slice(0, 6)) { const card = el('button', 'mini'); card.title = d.controllerName && d.controllerName !== d.name ? `${d.name} · ${d.controllerName}` : d.name; card.addEventListener('click', () => page('devices')); const text = el('div'); text.append(el('h3', '', d.name), el('p', '', `${d.ledCount} LEDs / ${deviceTypeLabel(d)}`), el('span', `device-status ${d.status === 'online' && !d.error ? 'online' : ''}`, d.error ? T('VERIFICAR AJUSTE') : d.status === 'online' ? T('● CONECTADO') : T('● DESCONECTADO'))); const artwork = el('span', 'device-icon'); artwork.append(icon(deviceIconName(d))); card.append(artwork, text); container.append(card); }
  }
  let activeDeviceFilter = 'all';
  document.querySelectorAll('[data-device-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDeviceFilter = btn.dataset.deviceFilter || 'all';
      document.querySelectorAll('[data-device-filter]').forEach(b => b.classList.toggle('active', b === btn));
      if (state.hardware?.devices) renderDevices(state.hardware.devices);
    });
  });

  function renderDevices(devices) {
    if ($('devices').contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;
    const container = $('devices'); container.replaceChildren();

    const isPeripheral = d => d.type === 5 || d.type === 6 || d.type === 7 || d.type === 8;
    const internalCount = devices.filter(d => !isPeripheral(d)).length;
    const peripheralsCount = devices.filter(isPeripheral).length;
    const filterAllCount = $('filter-all-count'); if (filterAllCount) filterAllCount.textContent = devices.length;
    const filterIntCount = $('filter-internal-count'); if (filterIntCount) filterIntCount.textContent = internalCount;
    const filterPeriCount = $('filter-peripherals-count'); if (filterPeriCount) filterPeriCount.textContent = peripheralsCount;

    let filtered = devices;
    if (activeDeviceFilter === 'internal') {
      filtered = devices.filter(d => !isPeripheral(d));
    } else if (activeDeviceFilter === 'peripherals') {
      filtered = devices.filter(isPeripheral);
    }

    if (!filtered.length) {
      const msg = activeDeviceFilter === 'peripherals'
        ? 'Nenhum periférico detectado nesta seção.'
        : activeDeviceFilter === 'internal'
        ? 'Nenhum componente interno detectado nesta seção.'
        : state.hardware.connected && state.hardware.detecting
        ? 'Detectando componentes RGB no controlador…'
        : 'Nenhum dispositivo detectado. Não mostramos componentes simulados.';
      return empty(container, T(msg));
    }
    for (const d of filtered) {
      const card = el('article', 'panel device-card'); const heading = el('div', 'panel-heading'); const title = el('div');
      const syncRow = el('div', 'device-sync-row');
      const isUnsyncedKb = d.type === 5 && d.settings.syncWithPc === false;
      const syncLabelText = d.mapExcluded ? T('Ajuste individual · fora do mapa') : isUnsyncedKb ? T('Desvinculado do PC') : d.customized ? T('Ajuste individual') : T('Segue o controle geral');
      syncRow.append(el('span', `sync-label ${d.customized || d.mapExcluded || isUnsyncedKb ? 'customized' : ''}`, syncLabelText));
      if (d.mapExcluded) { const follow = el('button', 'button subtle follow-map-button', T('Voltar a seguir o mapa')); follow.type = 'button'; follow.addEventListener('click', () => action(`/api/devices/${d.id}`, { followMap: true })); syncRow.append(follow); }
      if (d.type === 5) {
        const syncLabel = el('label', 'sync-pc-toggle');
        const syncCheck = el('input');
        syncCheck.type = 'checkbox';
        syncCheck.checked = d.settings.syncWithPc !== false;
        syncCheck.setAttribute('aria-label', T('Sincronizar com o PC'));
        syncCheck.addEventListener('change', () => action(`/api/devices/${d.id}`, { syncWithPc: syncCheck.checked }));
        syncLabel.append(syncCheck, el('span', '', T('Sincronizar com o PC')));
        syncRow.append(syncLabel);
      }
      title.append(el('h2', '', d.name), el('span', 'muted small', [d.controllerName && d.controllerName !== d.name ? d.controllerName : d.vendor, deviceTypeLabel(d), `${d.ledCount} LEDs`, d.status === 'online' ? T('Conectado') : T('Desconectado')].filter(Boolean).join(' · ')), syncRow);
      const power = el('label', 'switch'); const check = el('input'); check.type = 'checkbox'; check.checked = d.settings.power; check.setAttribute('aria-label', T`Ligar ${d.name}`); check.addEventListener('change', () => action(`/api/devices/${d.id}`, { power: check.checked })); power.append(check, el('span')); heading.append(title, power); card.append(heading);
      if (d.error) card.append(el('p', 'error', T(d.error)));
      if (d.powerTransitionFallback) card.append(el('p', 'muted small device-fallback-note', T('Modo nativo usa transição instantânea ao ligar ou desligar.')));
      const group = el('div', 'device-controls'); const colorLabel = el('label', '', T('Cor')); const color = el('input'); color.type = 'color'; color.value = d.settings.color; color.setAttribute('aria-label', T`Cor de ${d.name}`); color.addEventListener('change', () => action(`/api/devices/${d.id}`, { color: color.value, effect: 'static' })); color.disabled = !d.effects.includes('static'); colorLabel.append(color);
      const brightnessLabel = el('label', '', T`Brilho · ${d.settings.brightness}%`); const brightness = el('input'); brightness.type = 'range'; brightness.min = 0; brightness.max = 100; brightness.value = d.settings.brightness; brightness.setAttribute('aria-label', T`Brilho de ${d.name}`); brightness.addEventListener('change', () => action(`/api/devices/${d.id}`, { brightness: Number(brightness.value) })); brightnessLabel.append(brightness);
      const modeLabel = el('label', '', d.splitZone ? T('Efeito deste componente') : T('Efeito / modo do dispositivo')); const mode = el('select'); mode.setAttribute('aria-label', T`Modo de ${d.name}`);
      for (const effect of d.effects) { const option = el('option', '', labels[effect]); option.value = effect; mode.append(option); }
      for (const native of d.modes) { const option = el('option', '', `Hardware: ${native.name}`); option.value = `native:${native.id}`; mode.append(option); }
      mode.value = d.settings.nativeMode !== undefined ? `native:${d.settings.nativeMode}` : d.settings.effect;
      mode.addEventListener('change', () => action(`/api/devices/${d.id}`, mode.value.startsWith('native:') ? { nativeMode: Number(mode.value.slice(7)) } : { effect: mode.value })); modeLabel.append(mode); group.append(colorLabel, brightnessLabel, modeLabel); card.append(group);
      if (d.zones.length) { const details = el('details'); details.append(el('summary', '', T('Zonas e quantidade de LEDs'))); for (const z of d.zones) { const row = el('div', 'zone-row'); row.append(el('span', '', `${z.name} · ${z.leds} LEDs`)); if (z.resizable && admin) { const count = el('input'); count.type = 'number'; count.min = z.min; count.max = z.max; count.value = z.leds; count.setAttribute('aria-label', T`LEDs em ${z.name}`); const save = el('button', 'button subtle', T('Aplicar quantidade')); save.addEventListener('click', () => action(`/api/devices/${d.id}/resize`, { zone: z.id, count: Number(count.value) })); row.append(count, save); } details.append(row); } card.append(details); }
      container.append(card);
    }
  }
  function renderProfiles() {
    const container = $('profiles'); const signature = JSON.stringify([T.locale(), admin, state.profiles]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature; container.replaceChildren();
    if (!state.profiles?.length) return empty(container, admin ? T('Sua próxima combinação começa em + Criar perfil.') : T('Os perfis salvos no PC aparecem aqui.'));
    for (const p of state.profiles) {
      const card = el('article', 'profile-card'); if (/^#[a-f0-9]{6}$/i.test(p.color)) card.style.setProperty('--profile-color', p.color);
      const colors = p.settings?.palette?.length ? p.settings.palette : [p.color];
      const artwork = el('div', 'scene-art'); artwork.style.setProperty('--scene-palette', paletteGradient(colors));
      card.append(artwork, el('span', 'scene-tag', T('CRIADO POR VOCÊ')), el('h2', '', p.name));
      const meta = el('div', 'scene-meta'); meta.append(el('span', '', p.spatial ? T('Efeito no mapa') : labels[p.settings?.effect] || T('Ajustes salvos')), el('span', '', `${colors.length} ${colors.length === 1 ? T('cor') : T('cores')}`)); card.append(meta);
      card.append(el('p', '', p.deviceCount ? T`${p.deviceCount} componente(s) com ajustes individuais salvos.` : T`${p.settings?.brightness ?? 80}% de brilho · ${p.settings?.speed ?? 40}% de ritmo`));
      const apply = el('button', 'button primary', T('Ativar perfil')); apply.addEventListener('click', () => action(`/api/profiles/${p.id}`, {})); card.append(apply);
      if (admin) {
        const edit = el('button', 'button subtle', T('Editar')); edit.addEventListener('click', () => openProfile('custom', p)); card.append(edit);
        const copy = el('button','button subtle',T('Criar cópia'));copy.addEventListener('click',()=>action('/api/profiles/'+p.id+'/duplicate',{name:p.name.slice(0,40)+T(' cópia')}));card.append(copy);
        const remove = el('button', 'button subtle', T('Excluir')); remove.addEventListener('click', async () => { if (await action(`/api/profiles/${p.id}`, {}, 'DELETE')) { if (profileEditId === p.id) closeProfile(); } }); card.append(remove);
      }
      container.append(card);
    }
  }
  function renderPresets(force = false) {
    const quick = $('quick-presets'), gallery = $('preset-gallery');
    if (!force && quick.childElementCount === (state.presets || []).length && gallery.childElementCount) return;
    quick.replaceChildren(); gallery.replaceChildren();
    for (const preset of state.presets || []) {
      const gradient = `linear-gradient(125deg,${preset.colors.filter(color => /^#[a-f0-9]{6}$/i.test(color)).join(',')})`;
      const apply = () => action(`/api/presets/${preset.id}`, {});
      const shortcut = el('button', 'quick-preset', T(preset.name)); shortcut.title = T(preset.description); shortcut.style.setProperty('--scene-palette', gradient); shortcut.addEventListener('click', apply); quick.append(shortcut);
      const card = el('article', 'profile-card'); card.style.setProperty('--scene-palette', gradient); card.append(el('div', 'scene-art'), el('span', 'scene-tag', T(preset.tag)), el('h2', '', T(preset.name)), el('p', '', T(preset.description))); const meta = el('div', 'scene-meta'); meta.append(el('span', '', labels[preset.settings.effect]), el('span', '', T`${preset.settings.brightness}% brilho`)); card.append(meta); const button = el('button', 'button primary', T('Ativar cena')); button.setAttribute('aria-label', T`Ativar ${T(preset.name)}`); button.addEventListener('click', apply); card.append(button); gallery.append(card);
    }
  }
  let profileEditId = null, profileSnapshot = false, profileColors = [], profileSaving = false;
  function paletteGradient(colors) {
    const valid = colors.filter(color => /^#[a-f0-9]{6}$/i.test(color));
    return `linear-gradient(110deg,${(valid.length > 1 ? valid : [valid[0] || '#00f0ff', valid[0] || '#00f0ff']).join(',')})`;
  }
  for (const [value, name] of Object.entries(labels)) { const option = el('option', '', name); option.value = value; $('profile-effect').append(option); }
  function updateProfilePreview() {
    $('profile-preview').style.setProperty('--scene-palette', paletteGradient(profileColors));
    $('profile-preview').setAttribute('aria-label', T`Sequência: ${profileColors.join(', ')}`);
    const effect = $('profile-effect').value;
    $('profile-sequence-help').textContent = effect === 'static' ? T('Estático mantém a primeira cor. As outras ficam salvas para quando você mudar o movimento.') : `${descriptions[effect]}. ${['wave', 'rainbow'].includes(effect) ? T('As cores se misturam na ordem escolhida.') : T('As cores se alternam na ordem escolhida.')}`;
    $('profile-strobe-note').hidden = effect !== 'strobe';
    $('profile-speed').disabled = effect === 'static';
    for (const field of ['brightness', 'speed']) $(`profile-${field}-label`).textContent = `${$(`profile-${field}`).value}%`;
  }
  function renderProfileColors(focusIndex) {
    const container = $('profile-colors'); container.replaceChildren();
    profileColors.forEach((value, index) => {
      const item = el('div', 'sequence-color');
      const label = el('label', '', String(index + 1).padStart(2, '0')); const input = el('input'); input.type = 'color'; input.value = value; input.setAttribute('aria-label', T`Cor ${index + 1} da sequência`);
      input.addEventListener('input', () => { profileColors[index] = input.value; updateProfilePreview(); }); label.append(input);
      const actions = el('div', 'sequence-tools');
      for (const [delta, text] of [[-1, '←'], [1, '→']]) {
        const move = el('button', '', text); move.type = 'button'; move.disabled = index + delta < 0 || index + delta >= profileColors.length; move.setAttribute('aria-label', T`Mover cor ${index + 1} para ${delta < 0 ? T('esquerda') : T('direita')}`);
        move.addEventListener('click', () => { [profileColors[index], profileColors[index + delta]] = [profileColors[index + delta], profileColors[index]]; renderProfileColors(index + delta); }); actions.append(move);
      }
      const remove = el('button', '', '×'); remove.type = 'button'; remove.disabled = profileColors.length === 1; remove.setAttribute('aria-label', T`Remover cor ${index + 1}`); remove.addEventListener('click', () => { profileColors.splice(index, 1); renderProfileColors(Math.min(index, profileColors.length - 1)); }); actions.append(remove); item.append(label, actions); container.append(item);
    });
    $('profile-add-color').disabled = profileColors.length >= 8;
    updateProfilePreview();
    if (focusIndex !== undefined) container.querySelectorAll('input')[focusIndex]?.focus({ preventScroll: true });
  }
  function openProfile(type, profile) {
    if (!admin || profileSaving) return;
    profileEditId = profile?.id || null; profileSnapshot = type === 'snapshot';
    const settings = profile?.settings || state.master;
    profileColors = settings.palette?.length ? [...settings.palette] : [settings.color];
    $('profile-name').value = profile?.name || '';
    $('profile-effect').value = settings.effect;
    for (const field of ['brightness', 'speed']) $(`profile-${field}`).value = settings[field];
    $('profile-builder').hidden = profileSnapshot; $('profile-effect-field').hidden = profileSnapshot; $('profile-snapshot-note').hidden = !profileSnapshot;
    $('profile-editor-title').textContent = profile ? T('SEU ESTÚDIO / EDITAR PERFIL') : profileSnapshot ? T('GUARDAR / AJUSTES ATUAIS') : T('SEU ESTÚDIO / NOVO PERFIL');
    $('profile-edit-note').textContent = profile?.deviceCount || profile?.spatial ? T('Esta edição substitui o efeito do mapa e os ajustes individuais salvos por uma sequência para todos os componentes compatíveis.') : T('Ao ativar, todos os componentes compatíveis seguem este perfil.');
    renderProfileColors(); $('profile-form').hidden = false; $('profile-name').focus();
  }
  function closeProfile() { $('profile-form').hidden = true; profileEditId = null; }
  $('create-profile').addEventListener('click', () => openProfile('custom'));
  $('save-profile').addEventListener('click', () => openProfile('snapshot'));
  $('cancel-profile').addEventListener('click', () => { if (!profileSaving) closeProfile(); });
  $('profile-add-color').addEventListener('click', () => { if (profileColors.length < 8) { profileColors.push('#ffffff'); renderProfileColors(profileColors.length - 1); } });
  $('profile-effect').addEventListener('change', updateProfilePreview);
  for (const field of ['brightness', 'speed']) $(`profile-${field}`).addEventListener('input', updateProfilePreview);
  $('profile-form').addEventListener('submit', async event => {
    event.preventDefault(); if (profileSaving || !admin) return;
    const body = { name: $('profile-name').value };
    if (!profileSnapshot) body.settings = { power: true, color: profileColors[0], palette: [...profileColors], effect: $('profile-effect').value, brightness: Number($('profile-brightness').value), speed: Number($('profile-speed').value) };
    profileSaving = true; $('profile-submit').disabled = true; $('cancel-profile').disabled = true;
    const result = await action(profileEditId ? `/api/profiles/${profileEditId}` : '/api/profiles', body, profileEditId ? 'PUT' : 'POST');
    profileSaving = false; $('profile-submit').disabled = false; $('cancel-profile').disabled = false;
    if (result) { closeProfile(); toast(T('Perfil salvo. Use Ativar perfil quando quiser aplicar nas luzes.')); }
  });
  function peerRow(text, subtitle, buttonText, callback) { const row = el('div', 'peer-row'); const title = el('div', '', text); if (subtitle) title.append(el('small', '', subtitle)); const button = el('button', 'button subtle', buttonText); button.addEventListener('click', callback); row.append(title, button); return row; }
  async function loadNetwork() {
    if (!admin || loading) return; loading = true;
    try {
      networkInfo = await api('/api/network'); const select = $('network-select'); const preferred = networkInfo.selectedAddress || select.value; select.replaceChildren();
      for (const item of networkInfo.urls) { const option = el('option', '', `${item.name} — ${item.url}`); option.value = item.address; select.append(option); }
      if ([...select.options].some(o => o.value === preferred)) select.value = preferred;
      $('uptime').textContent = `${Math.floor(networkInfo.uptime / 3600)}h ${Math.floor(networkInfo.uptime % 3600 / 60)}min`;
      $('memory').textContent = `${networkInfo.memoryMB} MB`; $('data-directory').textContent = networkInfo.dataDirectory;
      const ports = networkInfo.ports; $('configured-ports').textContent = ports ? T`Painel ${ports.panel} · SDK ${ports.sdk} · Alexa ${ports.alexa}` : T('Consulte a configuração no ícone do Nexus.');
      $('alexa-status').textContent = T(networkInfo.alexa.status); $('alexa-enabled').checked = networkInfo.alexa.enabled;
      const diagnostic = networkInfo.alexa.diagnostics || {};
      const time = item => new Date(item.at).toLocaleTimeString(T.locale());
      $('alexa-light-name').textContent = T`A única luz aparece como ${networkInfo.alexa.lightName || 'Iluminação Nexus'}. Use “Alexa, acenda a Iluminação Nexus” ou “Alexa, apague a Iluminação Nexus”. Cor, brilho e efeitos ficam no app e são preservados ao religar.`;
      $('alexa-search-diagnostic').textContent = diagnostic.lastSearch ? T`Busca pela ponte recebida de ${diagnostic.lastSearch.ip} às ${time(diagnostic.lastSearch)}.` : T('Aguardando uma busca pela ponte na rede local.');
      $('alexa-http-diagnostic').textContent = diagnostic.lastHttp ? `${diagnostic.lastHttp.resource}: ${diagnostic.lastHttp.ip} · ${diagnostic.lastHttp.status === 403 ? T('aguardando autorização no painel') : diagnostic.lastHttp.status < 400 ? T('recebida') : T('recusada')} · ${time(diagnostic.lastHttp)}.` : T('O Echo ainda não consultou as luzes desta ponte.');
      $('alexa-command-diagnostic').textContent = diagnostic.lastCommand ? T`Último comando recebido: ${diagnostic.lastCommand.name} · luzes ${diagnostic.lastCommand.power ? T('ligadas') : T('apagadas')} · ${time(diagnostic.lastCommand)}.` : T('Nenhum comando de iluminação recebido nesta sessão.');
      $('discover-alexa').disabled = !networkInfo.alexa.enabled;
      const candidates = $('alexa-candidates'); candidates.replaceChildren();
      for (const ip of networkInfo.alexa.candidates.filter(ip => !networkInfo.alexa.peers.includes(ip))) candidates.append(peerRow(ip, T('Confira se este IP pertence ao seu Echo.'), T('Autorizar Echo'), async () => { await action('/api/alexa/approve', { ip }); loadNetwork(); }));
      const peers = $('alexa-peers'); peers.replaceChildren(); for (const ip of networkInfo.alexa.peers) peers.append(peerRow(ip, T('Echo autorizado na rede local'), T('Remover'), async () => { await action('/api/alexa/revoke', { ip }); loadNetwork(); }));
    } catch (error) { toast(error.message); } finally { loading = false; }
  }
  $('network-select').addEventListener('change', async () => {
    if (!admin) return;
    const address = $('network-select').value;
    if (networkInfo) networkInfo.selectedAddress = address;
    const saved = await action('/api/network', { address });
    if (saved && !$('qr-box').hidden) {
      const data = await action('/api/link', { address });
      if (data) { mobileLink = data.link; $('qr-image').src = data.qr; $('pair-link').href = data.link; $('pair-link').textContent = data.link; }
    }
  });
  $('generate-qr').addEventListener('click', async () => {
    const data = await action('/api/link', { address: $('network-select').value }); if (!data) return;
    if (networkInfo && data.address) networkInfo.selectedAddress = data.address;
    mobileLink = data.link; $('qr-image').src = data.qr; $('pair-link').href = data.link; $('pair-link').textContent = data.link; $('qr-box').hidden = false;
  });
  $('copy-link').addEventListener('click', async () => {
    try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(mobileLink); else { const input = el('textarea'); input.value = mobileLink; document.body.append(input); input.select(); if (!document.execCommand('copy')) throw new Error(); input.remove(); } toast(T('Link copiado.')); } catch { toast(T('Selecione e copie o link exibido acima.')); }
  });
  $('alexa-enabled').addEventListener('change', async event => { await action('/api/alexa', { enabled: event.target.checked }); loadNetwork(); });
  $('discover-alexa').addEventListener('click', async () => { if (await action('/api/alexa/discover', {})) toast(T('Agora peça à Alexa para descobrir dispositivos.')); loadNetwork(); });
  function scheduleReconnect() {
    if (reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; initialize(); }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  }
  async function initialize() {
    if (initializing) return;
    initializing = true; clearTimeout(reconnectTimer); reconnectTimer = null;
    events?.close(); events = null;
    try {
      const localSession=onThisPC?await api('/api/session/local', {}):null;
      const session = await api('/api/session'); admin = session.admin; render(await api('/api/state'));
      if(localSession?.welcome)$('welcome-dialog').showModal();
      reconnectDelay = 3000; events = new EventSource('/api/events');
      events.onmessage = event => { try { render(JSON.parse(event.data)); } catch { toast(T('Não foi possível atualizar o estado.')); } };
      events.onerror = () => { events?.close(); events = null; $('connection').textContent = T('● Reconectando ao PC…'); $('connection').className = 'badge offline'; enable(false); scheduleReconnect(); };
    } catch (error) { $('connection').textContent = T('● PC indisponível'); $('connection').className = 'badge offline'; enable(false); if (reconnectDelay === 3000) toast(error.message); scheduleReconnect(); }
    finally { initializing = false; }
  }
  window.addEventListener('nexus:languagechange', () => {
    document.querySelectorAll('.effect').forEach(b => { b.querySelector('.effect-name').textContent = labels[b.dataset.effect]; b.querySelector('small').textContent = descriptions[b.dataset.effect]; });
    document.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-label', T`Usar cor ${b.dataset.color}`));
    for (const option of $('profile-effect').options) option.textContent = labels[option.value];
    if (state) { render(state); renderPresets(true); }
    $('page-title').textContent = T({control:'Iluminação',devices:'Dispositivos',profiles:'Perfis',connect:'Conexões',studio:'Mapa do setup',settings:'Configurações'}[currentPage]);
    if (!$('profile-form').hidden) {
      renderProfileColors();
      $('profile-editor-title').textContent = T(profileEditId ? 'SEU ESTÚDIO / EDITAR PERFIL' : profileSnapshot ? 'GUARDAR / AJUSTES ATUAIS' : 'SEU ESTÚDIO / NOVO PERFIL');
    }
    if (networkInfo && currentPage === 'connect') loadNetwork();
  });
  $('page-title').textContent = T('Iluminação');
  $('welcome-start').addEventListener('click',()=>$('welcome-dialog').close());
  $('welcome-guide').addEventListener('click',()=>$('welcome-dialog').close());
  enable(false); initialize();
  setInterval(() => { if (currentPage === 'connect' && admin && !document.hidden) loadNetwork(); }, 5000);
  window.addEventListener('online', initialize); window.addEventListener('pageshow', event => { if (event.persisted) initialize(); });
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
