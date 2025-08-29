// Starts the API server backed by an in-memory MongoDB for E2E
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongo = await MongoMemoryServer.create();
  process.on('exit', async () => { try { await mongo.stop(); } catch {} });
  process.on('SIGINT', async () => { try { await mongo.stop(); } catch {} process.exit(0); });

  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';
  process.env.PORT = process.env.PORT || '8080';
  process.env.NODE_ENV = process.env.NODE_ENV || 'e2e';

  // Require the app which will auto-start (server.js calls start() when NODE_ENV !== 'test')
  // eslint-disable-next-line global-require
  require('../server');
})();

