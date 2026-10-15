'use strict';
function port(value, name, allowZero = false) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) throw new Error(`Porta ${name} inválida.`);
  const result = Number(value);
  if (!Number.isInteger(result) || result < (allowZero ? 0 : 1) || result > 65535) throw new Error(`Porta ${name}: use um número de 1 a 65535.`);
  return result;
}
function ports(options = {}, env = process.env) {
  const values = { panel: port(options.localPort ?? env.NEXUS_PORT ?? 5050, 'do painel', options.localPort === 0), sdk: port(options.rgbPort ?? env.NEXUS_RGB_PORT ?? 6743, 'SDK'), alexa: port(options.alexaPort ?? env.NEXUS_ALEXA_PORT ?? 80, 'Alexa', options.alexaPort === 0) };
  const assigned = Object.values(values).filter(value => value !== 0);
  if (new Set(assigned).size !== assigned.length) throw new Error('Painel, SDK e Alexa precisam de portas TCP diferentes.');
  return values;
}
module.exports = { port, ports };
