// Runs before any test file is loaded (see .mocharc.js).
//
// These must be set BEFORE server.js / db.js are required,
// because db.js reads DB_NAME when it is first loaded.

const fs = require('fs');
const os = require('os');
const path = require('path');

// Never touch the real "chatapp" database.
process.env.DB_NAME = 'chatapp_test';

// Uploaded test images go to a throwaway folder.
process.env.UPLOAD_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), 'chatapp-test-uploads-')
);

const { connectDb, closeDb } = require('../db');

// Root hooks: run once around the whole test run.
exports.mochaHooks = {

  async beforeAll() {
    await connectDb();
  },

  async afterAll() {

    const { getDb } = require('../db');
    await getDb().dropDatabase();
    await closeDb();

    fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  }
};
