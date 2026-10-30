require('dotenv').config();
const { startBot } = require('./bot');
const { startWeb } = require('./web');
(async () => { await startBot(); await startWeb(); })().catch(e => { console.error(e); process.exit(1); });
