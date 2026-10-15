'use strict';
const fs = require('node:fs');
const path = require('node:path');
function validateRelease({ tag, version, appInfo, installer, readme, notes }) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/.exec(tag || '');
  if (!match) throw new Error('Tag inválida. Use vX.Y.Z ou vX.Y.Z-alpha.N.');
  const base = match.slice(1, 4).join('.');
  if (base !== version) throw new Error('A tag não corresponde à versão do package.json.');
  for (const field of ['AssemblyVersion', 'AssemblyFileVersion']) {
    if (!appInfo.includes('[' + 'assembly: ' + field + '("' + base + '.0")]')) throw new Error('Versão nativa divergente: ' + field);
  }
  if (!installer.includes('#define AppVersion "' + base + '"') || !installer.includes('VersionInfoVersion=' + base + '.0')) throw new Error('Versão do instalador divergente.');
  const links = [...readme.matchAll(/https:\/\/github\.com\/JonJonGf\/nexus-rgb\/releases\/(?:tag|download)\/(v[^\s/)"]+)/g)].map(m => m[1]);
  if (!links.length || links.some(value => value !== tag)) throw new Error('Os links de versão do README precisam apontar para a tag publicada.');
  for (const name of ['NexusRGB-Setup-' + base + '.exe', 'NexusRGB-Uninstall-' + base + '.exe']) {
    if (!readme.includes('/releases/download/' + tag + '/' + name)) throw new Error('Download ausente no README: ' + name);
  }
  if (typeof notes !== 'string' || !notes.trim() || !notes.includes(tag)) throw new Error('Notas da versão ausentes ou divergentes.');
  return { tag, version: base, prerelease: Boolean(match[4]) };
}
if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
    // Validate the tag before using it as a file name.
    if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(tag || '')) throw new Error('Tag inválida.');
    const read = name => fs.readFileSync(path.join(root, name), 'utf8');
    const result = validateRelease({ tag, version: JSON.parse(read('package.json')).version, appInfo: read('native/AppInfo.cs'), installer: read('installer/NexusRGB.iss'), readme: read('README.md'), notes: read('docs/releases/' + tag + '.md') });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateRelease };
