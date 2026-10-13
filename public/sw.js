'use strict';
// No API or HTML cache: authentication and hardware status always come from the PC.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => { if (new URL(event.request.url).origin === self.location.origin) event.respondWith(fetch(event.request)); });
