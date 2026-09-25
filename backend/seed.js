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

// The Phase 1 JSON can reference users that were deleted
// before delete-user cleaned up memberships. Drop those ids
// so a new user who reuses the id doesn't inherit them.
const USER_ID_FIELDS = {
  groups: ['adminIds', 'memberIds'],
  channels: ['memberIds']
};

function removeStaleUserIds(name, docs, validUserIds) {

  const fields = USER_ID_FIELDS[name] || [];

  for (const doc of docs) {
    for (const field of fields) {

      const ids = Array.isArray(doc[field]) ? doc[field] : [];
      const kept = ids.filter(id => validUserIds.has(id));

      if (kept.length !== ids.length) {
        console.log(
          `  ${name} ${doc.id}: removed missing users ` +
          `${ids.filter(id => !validUserIds.has(id))} from ${field}`
        );
      }

      doc[field] = kept;
    }
  }
}

async function seed() {

  const db = await connectDb();

  const validUserIds = new Set(
    readJson(SOURCES.users).map(user => user.id)
  );

  for (const [name, file] of Object.entries(SOURCES)) {

    const docs = readJson(file);

    removeStaleUserIds(name, docs, validUserIds);

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

  await db.collection('groups').createIndex(
    { name: 1 },
    {
      unique: true,
      collation: { locale: 'en', strength: 2 }
    }
  );

  // Channel names only need to be unique within a group.
  // This index also serves "all channels in group X" queries.
  await db.collection('channels').createIndex(
    { groupId: 1, name: 1 },
    {
      unique: true,
      collation: { locale: 'en', strength: 2 }
    }
  );
  await db.collection('requests').createIndex({ status: 1 });
  await db.collection('messages').createIndex(
    { id: 1 },
    { unique: true }
  );

  // Serves "latest messages in channel X" queries.
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
