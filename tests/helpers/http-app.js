'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { createApp } = require('../../server');
async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-security-'));
  const app = await createApp({ directory, localPort: 0, disableHardware: true, disableAlexa: true, ...options });
  const { localPort } = await app.start(); const origin = `http://127.0.0.1:${localPort}`;
  t.after(async () => { await app.stop(); fs.rmSync(directory, { recursive: true, force: true }); });
  function request(route, { method = 'GET', body, headers = {}, cookie = '', host = origin, chunked = false } = {}) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
      const req = http.request(host + route, { method, agent: false, headers: { ...(data !== undefined ? { Origin: host, 'X-Nexus-Client': 'web', 'Content-Type': 'application/json', ...(chunked ? { 'Transfer-Encoding': 'chunked' } : { 'Content-Length': Buffer.byteLength(data) }) } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers } }, res => {
        const chunks = []; res.on('error', reject); res.on('data', data => chunks.push(data)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString(), json: () => JSON.parse(Buffer.concat(chunks).toString()) }));
      });
      req.on('error', reject); req.setTimeout(15000, () => req.destroy(Error('Test HTTP timeout')));
      if (chunked && data) { for (let start = 0; start < data.length; start += 2048) req.write(data.slice(start, start + 2048)); req.end(); } else req.end(data);
    });
  }
  const session = await request('/api/session/local', { method: 'POST', body: {} });
  if (session.status !== 200) throw Error('Session unavailable.');
  const cookie = session.headers['set-cookie'][0].split(';')[0];
  return { app, origin, directory, request, cookie, localPort };
}
module.exports = { fixture };
