// Cypress end-to-end test configuration.
//
// Run everything with:  npm run e2e
// That starts the backend on the separate "chatapp_e2e"
// database (port 3000) and `ng serve` (port 4200), runs
// every spec in cypress/e2e, then stops both servers.

const path = require('path');
const { defineConfig } = require('cypress');
const { io } = require('socket.io-client');

// Shared test data and reset logic from the backend, so
// Mocha and Cypress use exactly the same known data.
const backend = path.join(__dirname, '../../backend');
const { MongoClient } = require(path.join(backend, 'node_modules/mongodb'));
const { USERS, loadFixtures } = require(path.join(backend, 'test/fixtures'));

const SERVER_URL = 'http://localhost:3000';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';

// A second "person" in the chat, driven from Node over a real
// socket while Cypress controls the browser user.
const otherUsers = new Map();

function emitWithAck(socket, event, payload) {
  return new Promise(resolve => socket.emit(event, payload, resolve));
}

module.exports = defineConfig({

  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: false,
    defaultCommandTimeout: 8000,

    setupNodeEvents(on) {

      on('task', {

        // Wipe chatapp_e2e and load the known data.
        async resetDb() {

          // Close any sockets left over from the last test.
          otherUsers.forEach(socket => socket.disconnect());
          otherUsers.clear();

          const client = new MongoClient(MONGO_URL);

          try {
            await client.connect();
            await loadFixtures(client.db('chatapp_e2e'));
          } finally {
            await client.close();
          }

          return null;
        },

        // Usernames and passwords of the test accounts.
        users() {
          return USERS;
        },

        // Connect another user and join a channel.
        async otherUserJoins({ userId, channelId }) {

          const socket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });
          await new Promise(resolve => socket.on('connect', resolve));

          const ack = await emitWithAck(socket, 'joinChannel', { userId, channelId });

          if (!ack.ok) {
            throw new Error(`Other user could not join: ${ack.message}`);
          }

          otherUsers.set(userId, socket);
          return null;
        },

        otherUserTypes({ userId, channelId }) {
          otherUsers.get(userId).emit('typing', { channelId, isTyping: true });
          return null;
        },

        async otherUserSends({ userId, channelId, text }) {
          const ack = await emitWithAck(otherUsers.get(userId), 'sendMessage', { channelId, text });
          return ack.ok ? ack.message : Promise.reject(new Error(ack.message));
        },

        otherUserLeaves({ userId }) {
          otherUsers.get(userId).disconnect();
          otherUsers.delete(userId);
          return null;
        }
      });
    }
  }
});
