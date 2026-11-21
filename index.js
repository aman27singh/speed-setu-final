/**
 * Speed Setu Application Entry Forwarder
 * Enables deployment platforms executing from repository root to seamlessly launch the server.
 */
const path = require('path');
process.chdir(path.join(__dirname, 'server'));

const app = require('./server/index.js');

if (require.main === module && typeof app.startServer === 'function') {
  app.startServer();
}

module.exports = app;
