const fs = require('fs');
const path = require('path');
const {
  connectDb,
  closeDb
} = require('./db');

// ====================================================
// SEED MONGODB FROM THE PHASE 1 JSON FILES
// ====================================================
// Usage: npm run seed
// WARNING: this drops and recreates the collections below,
// so any data already in MongoDB is replaced.

const DATA_DIR = path.join(
  __dirname,
  'DATA FOR THE APP PHASE 1'
);

// collection name -> JSON file
const SOURCES = {
  users: 'user.json',
  groups: 'groups.json',
  channels: 'channels.json',
  requests: 'requests.json',
  audit: 'audit.json'
};

function readJson(file) {
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), 'utf8')
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Could not read ${file}:`, error.message);
    return [];
  }
}

async function seed() {

  const db = await connectDb();

  for (const [name, file] of Object.entries(SOURCES)) {

    const docs = readJson(file);

    await db.collection(name).drop().catch(() => {});

    if (docs.length) {
      await db.collection(name).insertMany(docs);
    }

    // Start the id counter after the highest existing id.
    const maxId = docs.reduce(
      (max, doc) => Math.max(max, Number(doc.id) || 0),
      0
    );

    await db.collection('counters').updateOne(
      { _id: name },
      { $set: { seq: maxId } },
      { upsert: true }
    );

    console.log(
      `${name}: inserted ${docs.length} (next id ${maxId + 1})`
    );
  }

  // Messages have no Phase 1 data - start them empty.
  await db.collection('messages').drop().catch(() => {});
  await db.collection('counters').updateOne(
    { _id: 'messages' },
    { $set: { seq: 0 } },
    { upsert: true }
  );

  // Indexes: fast lookups by id, and no duplicate usernames.
  for (const name of Object.keys(SOURCES)) {
    await db.collection(name).createIndex(
      { id: 1 },
      { unique: true }
    );
  }

  await db.collection('users').createIndex(
    { username: 1 },
    {
      unique: true,
      // strength 2 = case-insensitive
      collation: { locale: 'en', strength: 2 }
    }
  );

  await db.collection('channels').createIndex({ groupId: 1 });
  await db.collection('requests').createIndex({ status: 1 });
  await db.collection('messages').createIndex(
    { channelId: 1, timestamp: 1 }
  );

  console.log('Seeding complete.');
}

seed()
  .catch(error => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(closeDb);
