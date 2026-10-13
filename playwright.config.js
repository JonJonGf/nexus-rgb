'use strict';
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/ui', workers: 1, timeout: 30000, use: { baseURL: 'http://127.0.0.1:5071', browserName: 'chromium', ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), screenshot: 'only-on-failure' }, webServer: { command: 'node server/index.js', url: 'http://127.0.0.1:5071/api/health', reuseExistingServer: false, env: { NEXUS_PORT: '5071', NEXUS_DISABLE_HARDWARE: '1', NEXUS_DATA_DIR: require('node:path').join(__dirname, 'test-results', 'ui-data') } } });
