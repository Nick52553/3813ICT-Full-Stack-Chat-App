// Starts the server for the Cypress end-to-end tests:
// same code as `npm start`, but on a separate database
// and uploads folder so the tests never touch real data.
//
// Usage: npm run start:e2e   (normally started for you by
// `npm run e2e` in frontend/chat-frontend)

const os = require('os');
const path = require('path');

// Must be set before server.js / db.js are loaded.
process.env.DB_NAME = 'chatapp_e2e';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'chatapp-e2e-uploads');

const { start } = require('./server');

start().catch(error => {
  console.error('Could not start the e2e server:', error.message);
  process.exit(1);
});
