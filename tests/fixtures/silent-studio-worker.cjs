'use strict';
// A process that starts but never completes its initialization handshake.
process.on('message', () => {});
