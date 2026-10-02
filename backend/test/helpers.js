// Shared test data and helpers.

const request = require('supertest');
const { getDb, createIndexes } = require('../db');
const { hashPassword } = require('../passwords');
const { app } = require('../server');

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

// Wipe the test database and load the known data above.
async function resetDatabase() {

  const db = getDb();

  // Belt and braces: refuse to wipe anything but a test DB.
  if (!db.databaseName.endsWith('_test')) {
    throw new Error(`Refusing to reset non-test database "${db.databaseName}"`);
  }

  await db.dropDatabase();

  // structuredClone so tests can't change the shared fixtures.
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

// Smallest valid images, for upload tests.
const IMAGES = {
  png: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a1c2a4d10000000049454e44ae426082', 'hex'),
  gif: Buffer.from('47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b', 'hex'),
  jpg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64), Buffer.from([0xff, 0xd9])]),
  // Named like an image but isn't one.
  fake: Buffer.from('MZ - this is really a program')
};

module.exports = {
  api: () => request(app),
  db: () => getDb(),
  resetDatabase,
  USERS,
  GROUPS,
  CHANNELS,
  IMAGES
};
