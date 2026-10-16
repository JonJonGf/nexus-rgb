'use strict';
(() => {
  const english = window.NexusEnglish;
  const patterns = Object.entries(english).filter(([key]) => key.includes('{0}')).map(([key, value]) => ({ pattern: new RegExp('^' + key.split(/\{\d+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$', 's'), value }));
  let language;
  try { language = localStorage.getItem('nexus.language'); } catch {}
  if (!['pt-BR', 'en'].includes(language)) language = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  function text(key, ...values) {
    if (Array.isArray(key)) key = key.map((part, i) => part + (i < values.length ? '{' + i + '}' : '')).join('');
    let translated = language === 'en' && Object.hasOwn(english, key) ? english[key] : key;
    // API messages carry values, whereas first-party UI templates pass them separately.
    if (language === 'en' && !values.length && typeof key === 'string' && key.length <= 4096 && !Object.hasOwn(english, key)) {
      for (const { pattern, value } of patterns) { const match = pattern.exec(key); if (match) { translated = value.replace(/\{(\d+)\}/g, (_, i) => match[Number(i) + 1]); break; } }
    }
    return values.length ? translated.replace(/\{(\d+)\}/g, (_, i) => String(values[i] ?? '')) : translated;
  }
  text.map = object => new Proxy(object, { get: (target, key) => typeof target[key] === 'string' ? text(target[key]) : target[key] });
  text.locale = () => language;
  function apply() {
    document.documentElement.lang = language;
    for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = text(element.dataset.i18n);
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) for (const element of document.querySelectorAll('[data-i18n-' + attr + ']')) element.setAttribute(attr, text(element.getAttribute('data-i18n-' + attr)));
    const select=document.getElementById('settings-language');if(select)select.value = language;
  }
  text.set = value => {
    if (!['pt-BR', 'en'].includes(value) || value === language) return;
    const name = document.getElementById('formula-name'), defaultName = text('Minha onda'), defaultOnly = name?.value === defaultName;
    language = value;
    try { localStorage.setItem('nexus.language', language); } catch {}
    apply(); if (defaultOnly) name.value = text('Minha onda');
    window.dispatchEvent(new Event('nexus:languagechange'));
  };
  window.NexusI18n = text;
  apply();
  for (const id of ['page-title', 'connection', 'preview-effect', 'summary-power', 'hardware-summary', 'studio-state', 'studio-current-effect', 'studio-dirty', 'studio-live-note', 'studio-map-summary', 'studio-metrics']) {
    const element = document.getElementById(id); if(element)element.textContent = text(element.textContent);
  }
  const name = document.getElementById('formula-name'); if(name)name.value = text('Minha onda');
  document.getElementById('settings-language')?.addEventListener('change', e => text.set(e.target.value));
})();
