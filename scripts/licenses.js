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
    const license = fs.readdirSync(folder).find(name => /^(LICENSE|LICENCE|COPYING)(\.|$)/i.test(name));
    packages.push({ name: pkg.name, version: pkg.version, license: pkg.license, repository: pkg.repository });
    if (license) fs.copyFileSync(path.join(folder, license), path.join(root, 'licenses', `${pkg.name.replace(/[@/]/g, '_')}-${pkg.version}-${license}`));
    if (fs.existsSync(path.join(folder, 'node_modules'))) visit(path.join(folder, 'node_modules'));
  }
}
visit(path.join(root, 'node_modules')); fs.writeFileSync(path.join(root, 'licenses', 'npm-packages.json'), JSON.stringify(packages, null, 2));
