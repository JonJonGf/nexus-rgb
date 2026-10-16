'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
function segment(value) {
  if (typeof value !== 'string' || !value || value.length > 200 || /[\\/:*?"<>|\x00-\x1f]/.test(value) || value === '.' || value === '..') throw Error('Nome de arquivo de licença inválido.');
  return value;
}
function collectLicenses(directory) {
  const root = path.resolve(directory), destination = path.join(root, 'licenses'), packages = [];
  if (!fs.lstatSync(destination).isDirectory() || fs.lstatSync(destination).isSymbolicLink()) throw Error('Pasta de licenças inválida.');
  function copy(source, name) {
    const target = path.join(destination, segment(name));
    if (path.dirname(target) !== destination || !fs.lstatSync(source).isFile() || fs.lstatSync(source).isSymbolicLink()) throw Error('Arquivo de licença inválido.');
    const temporary = path.join(destination, '.license-' + crypto.randomBytes(12).toString('hex') + '.tmp'); let created = false;
    try { fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL); created = true; fs.renameSync(temporary, target); created = false; }
    finally { if (created) fs.unlinkSync(temporary); }
  }
  function visit(folder) {
    if (fs.lstatSync(folder).isSymbolicLink()) throw Error('Pasta de dependência redirecionada.');
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const current = path.join(folder, segment(entry.name));
      if (entry.name.startsWith('@')) { visit(current); continue; }
      const packageFile = path.join(current, 'package.json'); if (!fs.existsSync(packageFile)) continue;
      const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      const prefix = segment(segment(pkg.name.replace(/[@/]/g, '_')) + '-' + segment(pkg.version));
      packages.push({ name: pkg.name, version: pkg.version, license: pkg.license, repository: pkg.repository });
      for (const license of fs.readdirSync(current).filter(name => /^(LICENSE|LICENCE|COPYING|NOTICE)([._-]|$)/i.test(name))) {
        const source = path.join(current, segment(license)); if (fs.lstatSync(source).isFile()) copy(source, prefix + '-' + segment(license));
      }
      const sbom = path.join(current, 'sbom.cdx.json'); if (fs.existsSync(sbom)) copy(sbom, prefix + '-sbom.cdx.json');
      if (fs.existsSync(path.join(current, 'node_modules'))) visit(path.join(current, 'node_modules'));
    }
  }
  visit(path.join(root, 'node_modules'));
  require('../server/store').writeJson(path.join(destination, 'npm-packages.json'), packages);
  copy(path.join(root, 'docs', 'licenses', 'canvas-1.0.11-NOTICES.txt'), 'canvas-1.0.11-NOTICES.txt');
  return packages;
}
if (require.main === module) collectLicenses(process.argv[2]);
module.exports = { collectLicenses };
