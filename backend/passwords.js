const bcrypt = require('bcryptjs');

// ====================================================
// PASSWORD HASHING
// ====================================================
// Passwords are stored as bcrypt hashes, never as the
// password itself. bcrypt is deliberately slow and adds a
// random salt, so a leaked database can't simply be read
// or looked up in a precomputed table.
//
// bcryptjs is a pure-JavaScript bcrypt: no native build
// step, so `npm install` works on any machine.

// Cost factor: each +1 doubles the work. 10 takes roughly
// 50-100ms per hash - unnoticeable at login, but very
// expensive for anyone guessing passwords in bulk.
const BCRYPT_ROUNDS = 10;

// A real bcrypt hash looks like $2a$10$<53 more chars>.
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

function isHashed(value) {
  return typeof value === 'string' && BCRYPT_PATTERN.test(value);
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Hash of a random value, compared against when a username
// doesn't exist, so "no such user" takes as long as "wrong
// password" and response times don't reveal which usernames
// are registered.
const dummyHash = bcrypt.hashSync(
  require('crypto').randomUUID(),
  BCRYPT_ROUNDS
);

// True if `password` matches the stored hash. Pass null for
// `storedHash` when the user wasn't found.
async function verifyPassword(password, storedHash) {

  if (!isHashed(storedHash)) {
    await bcrypt.compare(password, dummyHash);
    return false;
  }

  return bcrypt.compare(password, storedHash);
}

// One-off upgrade for databases created before hashing was
// added: hash any password still stored as plain text.
// Safe to run on every start - hashed ones are skipped.
// Returns how many users were updated.
async function hashPlaintextPasswords(usersCollection) {

  const users = await usersCollection
    .find({}, { projection: { id: 1, password: 1 } })
    .toArray();

  let updated = 0;

  for (const user of users) {

    if (typeof user.password !== 'string' || isHashed(user.password)) {
      continue;
    }

    await usersCollection.updateOne(
      // Only if it hasn't changed since we read it.
      { _id: user._id, password: user.password },
      { $set: { password: await hashPassword(user.password) } }
    );

    updated++;
  }

  return updated;
}

module.exports = {
  BCRYPT_ROUNDS,
  isHashed,
  hashPassword,
  verifyPassword,
  hashPlaintextPasswords
};
