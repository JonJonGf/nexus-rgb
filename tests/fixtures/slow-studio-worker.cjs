'use strict';
// Simulate cold native-library initialization, then run the real isolated worker.
setTimeout(() => require('../../server/studio-worker'), 6200);
