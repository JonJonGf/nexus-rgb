'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { validateRelease } = require('../scripts/check-release.cjs');
function fixture() {
  return { tag: 'v0.1.0-alpha.5', version: '0.1.0',
    appInfo: '[assembly: AssemblyVersion("0.1.0.0")]\n[assembly: AssemblyFileVersion("0.1.0.0")]',
    installer: '#define AppVersion "0.1.0"\nVersionInfoVersion=0.1.0.0',
    readme: 'https://github.com/JonJonGf/nexus-rgb/releases/tag/v0.1.0-alpha.5\nhttps://github.com/JonJonGf/nexus-rgb/releases/download/v0.1.0-alpha.5/NexusRGB-Setup-0.1.0.exe\nhttps://github.com/JonJonGf/nexus-rgb/releases/download/v0.1.0-alpha.5/NexusRGB-Uninstall-0.1.0.exe',
    notes: '# v0.1.0-alpha.5\nMudanças da versão.' };
}
test('publicação exige código, executáveis e downloads da mesma versão', () => {
  assert.deepEqual(validateRelease(fixture()), { tag: 'v0.1.0-alpha.5', version: '0.1.0', prerelease: true });
  for (const change of [
    { tag: '../other' }, { tag: 'v0.2.0' }, { version: '0.2.0' },
    { appInfo: fixture().appInfo.replace('AssemblyFileVersion("0.1.0.0")', 'AssemblyFileVersion("0.2.0.0")') },
    { installer: '#define AppVersion "0.2.0"' },
    { readme: fixture().readme.replaceAll('alpha.5', 'alpha.4') },
    { readme: fixture().readme.replace('NexusRGB-Uninstall-0.1.0.exe', 'missing.exe') },
    { notes: '' }, { notes: '# v0.1.0-alpha.4' }
  ]) assert.throws(() => validateRelease({ ...fixture(), ...change }));
  const stable = fixture(); stable.tag = 'v0.1.0'; stable.readme = stable.readme.replaceAll('v0.1.0-alpha.5', stable.tag); stable.notes = '# v0.1.0';
  assert.equal(validateRelease(stable).prerelease, false);
});
