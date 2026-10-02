// Unit tests: passwords.js, plus the start-up upgrade of
// plain-text passwords against the test database.

const { expect } = require('chai');
const {
  hashPassword,
  verifyPassword,
  isHashed,
  hashPlaintextPasswords
} = require('../passwords');
const { db, resetDatabase } = require('./helpers');

describe('Unit: password hashing', () => {

  it('produces a bcrypt hash, not the password', async () => {
    const hash = await hashPassword('Secret123');

    expect(hash).to.not.include('Secret123');
    expect(isHashed(hash)).to.equal(true);
  });

  it('salts each hash, so the same password hashes differently', async () => {
    const a = await hashPassword('Secret123');
    const b = await hashPassword('Secret123');

    expect(a).to.not.equal(b);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Secret123');

    expect(await verifyPassword('Secret123', hash)).to.equal(true);
    expect(await verifyPassword('secret123', hash)).to.equal(false);
  });

  it('never matches a plain-text or missing stored value', async () => {
    expect(await verifyPassword('Secret123', 'Secret123')).to.equal(false);
    expect(await verifyPassword('Secret123', null)).to.equal(false);
  });

  describe('hashPlaintextPasswords (start-up upgrade)', () => {

    beforeEach(resetDatabase);

    it('hashes old plain-text passwords once and leaves hashes alone', async () => {
      const users = db().collection('users');
      await users.updateOne({ id: 3 }, { $set: { password: 'oldpass' } });

      expect(await hashPlaintextPasswords(users)).to.equal(1);

      const bobby = await users.findOne({ id: 3 });
      expect(isHashed(bobby.password)).to.equal(true);
      expect(await verifyPassword('oldpass', bobby.password)).to.equal(true);

      // Second run finds nothing to do.
      expect(await hashPlaintextPasswords(users)).to.equal(0);
    });
  });
});
