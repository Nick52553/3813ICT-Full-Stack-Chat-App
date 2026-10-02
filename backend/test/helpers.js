// Shared helpers for the Mocha tests.

const request = require('supertest');
const { getDb } = require('../db');
const { app } = require('../server');
const { USERS, GROUPS, CHANNELS, loadFixtures } = require('./fixtures');

// Wipe the test database and load the known data.
function resetDatabase() {
  return loadFixtures(getDb());
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
