'use strict';
const fs = require('node:fs'); const path = require('node:path');
const root = path.resolve(process.argv[2]); const packages = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const folder = path.join(directory, entry.name);
    if (entry.name.startsWith('@')) { visit(folder); continue; }
    const packageFile = path.join(folder, 'package.json'); if (!fs.existsSync(packageFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(packageFile));
    const licenses = fs.readdirSync(folder).filter(name => /^(LICENSE|LICENCE|COPYING|NOTICE)([._-]|$)/i.test(name) && fs.statSync(path.join(folder, name)).isFile());
    packages.push({ name: pkg.name, version: pkg.version, license: pkg.license, repository: pkg.repository });
    for (const license of licenses) fs.copyFileSync(path.join(folder, license), path.join(root, 'licenses', `${pkg.name.replace(/[@/]/g, '_')}-${pkg.version}-${license}`));
    const sbom = path.join(folder, 'sbom.cdx.json');
    if (fs.existsSync(sbom)) fs.copyFileSync(sbom, path.join(root, 'licenses', `${pkg.name.replace(/[@/]/g, '_')}-${pkg.version}-sbom.cdx.json`));
    if (fs.existsSync(path.join(folder, 'node_modules'))) visit(path.join(folder, 'node_modules'));
  }
}
visit(path.join(root, 'node_modules')); fs.writeFileSync(path.join(root, 'licenses', 'npm-packages.json'), JSON.stringify(packages, null, 2));
fs.copyFileSync(path.join(root, 'docs', 'licenses', 'canvas-1.0.11-NOTICES.txt'), path.join(root, 'licenses', 'canvas-1.0.11-NOTICES.txt'));
