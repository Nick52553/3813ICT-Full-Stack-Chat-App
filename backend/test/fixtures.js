// Known test data, shared by the Mocha tests (test/) and the
// Cypress end-to-end tests (frontend cypress.config.js).

const { createIndexes } = require('../db');
const { hashPassword } = require('../passwords');

// Known accounts. Passwords follow the current rules.
const USERS = {
  super: { id: 1, username: 'super', password: 'Super123', age: 30, role: 'superAdmin' },
  ben: { id: 2, username: 'ben', password: 'Admin123', age: 37, role: 'groupAdmin' },
  bobby: { id: 3, username: 'bobby', password: 'Bobby123', age: 21, role: 'user' },
  young: { id: 4, username: 'young', password: 'Young123', age: 15, role: 'user' },
  outsider: { id: 5, username: 'outsider', password: 'Outsider1', age: 25, role: 'user' }
};

// Group 1 has an age limit and Ben as its admin.
const GROUPS = [
  { id: 1, name: 'Gaming', description: 'Games', ageLimit: 18, adminIds: [2], memberIds: [2, 3] },
  { id: 2, name: 'Study', description: 'Study', ageLimit: 0, adminIds: [], memberIds: [3] }
];

const CHANNELS = [
  { id: 1, groupId: 1, name: 'General', description: '', memberIds: [2, 3] },
  { id: 2, groupId: 1, name: 'Raids', description: '', memberIds: [2] },
  { id: 3, groupId: 2, name: 'Homework', description: '', memberIds: [3] }
];

// Hashing is deliberately slow, so hash each password once
// and reuse it for every reset.
let hashedUsers = null;

async function getHashedUsers() {

  if (!hashedUsers) {
    hashedUsers = await Promise.all(
      Object.values(USERS).map(async user => ({
        ...user,
        password: await hashPassword(user.password)
      }))
    );
  }

  return hashedUsers;
}

// Wipe a test database and load the known data above.
async function loadFixtures(db) {

  // Belt and braces: refuse to wipe a real database.
  if (!/_(test|e2e)$/.test(db.databaseName)) {
    throw new Error(`Refusing to reset non-test database "${db.databaseName}"`);
  }

  await db.dropDatabase();

  // structuredClone so tests can't change the shared data.
  await db.collection('users').insertMany(structuredClone(await getHashedUsers()));
  await db.collection('groups').insertMany(structuredClone(GROUPS));
  await db.collection('channels').insertMany(structuredClone(CHANNELS));

  await db.collection('counters').insertMany([
    { _id: 'users', seq: 5 },
    { _id: 'groups', seq: 2 },
    { _id: 'channels', seq: 3 },
    { _id: 'requests', seq: 0 },
    { _id: 'audit', seq: 0 },
    { _id: 'messages', seq: 0 }
  ]);

  await createIndexes(db);
}

module.exports = {
  USERS,
  GROUPS,
  CHANNELS,
  loadFixtures
};
