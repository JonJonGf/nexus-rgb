'use strict';
// Uses the existing Windows Git Credential Manager. Never prints or writes credentials.
const { execFileSync } = require('node:child_process');
async function main() {
  const owner = process.argv[2]; const name = process.argv[3] || 'nexus-rgb';
  if (!owner || !/^[a-zA-Z0-9-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Uso: node scripts/github-create.js USUARIO NOME');
  const credential = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' } });
  const token = credential.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
  if (!token) throw new Error('Não há credencial local do GitHub no Git Credential Manager.');
  async function request(route, method = 'GET', data) {
    return fetch(`https://api.github.com${route}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  }
  const profile = await request('/user'); if (!profile.ok) throw new Error(`Autenticação GitHub falhou (${profile.status}).`);
  const user = await profile.json(); if (user.login.toLowerCase() !== owner.toLowerCase()) throw new Error('A credencial local pertence a outra conta.');
  const existing = await request(`/repos/${owner}/${name}`);
  let repository;
  if (existing.ok) { repository = await existing.json(); if (!repository.private) throw new Error('Já existe um repositório público com esse nome; não foi alterado.'); }
  else if (existing.status === 404) { const created = await request('/user/repos', 'POST', { name, private: true, description: 'Controle RGB local de PCs Windows — Nexus RGB', auto_init: false }); if (!created.ok) throw new Error(`Não foi possível criar o repositório (${created.status}).`); repository = await created.json(); }
  else throw new Error(`Consulta ao GitHub falhou (${existing.status}).`);
  console.log(JSON.stringify({ url: repository.html_url, cloneUrl: repository.clone_url, private: repository.private, createdOrExisting: true }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
