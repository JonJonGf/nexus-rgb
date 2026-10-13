'use strict';
// Local, immutable scenes. Names and settings are shipped with the application.
const presets = [
  { id: 'aurora', name: 'Aurora', description: 'Ondas de verde, turquesa e violeta.', tag: 'FLUIDO', colors: ['#00ff99', '#00c8ff', '#8156ff'], settings: { power: true, color: '#00e8bd', effect: 'wave', brightness: 65, speed: 24, palette: ['#00ff99', '#00c8ff', '#8156ff'] } },
  { id: 'brasa', name: 'Brasa', description: 'Âmbar que respira devagar, como fogo baixo.', tag: 'QUENTE', colors: ['#ff3d12', '#ff9a2b'], settings: { power: true, color: '#ff6a20', effect: 'breathe', brightness: 55, speed: 18 } },
  { id: 'nebulosa', name: 'Nebulosa', description: 'Violeta, magenta e azul em uma onda lenta.', tag: 'IMERSIVO', colors: ['#6846ff', '#e323bd', '#2469ff'], settings: { power: true, color: '#b75cff', effect: 'wave', brightness: 70, speed: 12, palette: ['#6846ff', '#e323bd', '#2469ff'] } },
  { id: 'abissal', name: 'Abissal', description: 'Azul profundo e ciano, com pouca luz.', tag: 'SUAVE', colors: ['#1644a8', '#00a6bb', '#1830a0'], settings: { power: true, color: '#208bdf', effect: 'wave', brightness: 30, speed: 9, palette: ['#1644a8', '#00a6bb', '#1830a0'] } },
  { id: 'solar', name: 'Solar', description: 'Pulsos de laranja para um setup aceso.', tag: 'ENERGIA', colors: ['#ff5722', '#ffc340'], settings: { power: true, color: '#ff9b2e', effect: 'pulse', brightness: 85, speed: 48 } },
  { id: 'silencio', name: 'Silêncio', description: 'Branco quente e baixo brilho para a noite.', tag: 'NOTURNO', colors: ['#ffcb92', '#ffe4c2'], settings: { power: true, color: '#ffdbb2', effect: 'static', brightness: 18, speed: 0 } }
];
function applyPreset(store, id) {
  const preset = presets.find(item => item.id === id);
  if (!preset) throw new Error('Perfil pronto não encontrado.');
  store.master({ ...preset.settings, palette: preset.settings.palette || [] });
}
module.exports = { presets, applyPreset };
