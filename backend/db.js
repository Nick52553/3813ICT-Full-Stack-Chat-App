const { MongoClient } = require('mongodb');

// ====================================================
// MONGODB CONNECTION
// ====================================================

// 127.0.0.1 rather than localhost: on Windows, localhost
// can resolve to IPv6 (::1), which MongoDB does not listen on.
const MONGO_URL =
  process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';

const DB_NAME =
  process.env.DB_NAME || 'chatapp';

const client = new MongoClient(MONGO_URL);

let db = null;

async function connectDb() {

  if (db) {
    return db;
  }

  await client.connect();

  db = client.db(DB_NAME);

  console.log(
    `Connected to MongoDB: ${MONGO_URL}/${DB_NAME}`
  );

  return db;
}

function getDb() {

  if (!db) {
    throw new Error(
      'Database not connected. Call connectDb() first.'
    );
  }

  return db;
}

async function closeDb() {
  await client.close();
  db = null;
}

// ====================================================
// NUMERIC IDS
// ====================================================

// The frontend uses numeric ids (1, 2, 3...), so each
// collection keeps a counter in the "counters" collection.
// $inc is atomic, so two requests can never get the same id.
async function getNextId(collectionName) {

  const counter = await getDb()
    .collection('counters')
    .findOneAndUpdate(
      { _id: collectionName },
      { $inc: { seq: 1 } },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

  return counter.seq;
}

module.exports = {
  connectDb,
  getDb,
  closeDb,
  getNextId
};
