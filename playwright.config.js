'use strict';
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/ui', workers: 1, retries: process.env.CI ? 2 : 1, timeout: 30000, use: { locale: 'pt-BR', baseURL: 'http://127.0.0.1:5071', browserName: 'chromium', ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), screenshot: 'only-on-failure' } });
