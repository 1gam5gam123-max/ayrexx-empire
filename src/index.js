require('dotenv').config();
const store = require('./store');
const { startBot } = require('./bot');
const { startWeb } = require('./web');
(async () => { await store.connect(); await startBot(); await startWeb(); })().catch(e => { console.error(e); process.exit(1); });
