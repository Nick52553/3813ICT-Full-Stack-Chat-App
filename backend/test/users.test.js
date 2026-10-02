// Integration tests: users, deletion and the audit log.

const { expect } = require('chai');
const { api, db, resetDatabase } = require('./helpers');
const { isHashed } = require('../passwords');

describe('API: users', () => {

  beforeEach(resetDatabase);

  describe('GET /api/users', () => {

    it('lists every user without passwords', async () => {
      const res = await api().get('/api/users');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.length(5);
      res.body.forEach(user => expect(user).to.not.have.property('password'));
    });
  });

  describe('POST /api/users (sign-up)', () => {

    const valid = { username: 'newbie', password: 'Newbie123', age: 20 };

    it('creates a regular user with the next id', async () => {
      const res = await api().post('/api/users').send(valid);

      expect(res.status).to.equal(201);
      expect(res.body).to.include({ id: 6, username: 'newbie', role: 'user' });
    });

    it('stores only a bcrypt hash of the password', async () => {
      await api().post('/api/users').send(valid);

      const stored = await db().collection('users').findOne({ username: 'newbie' });

      expect(stored.password).to.not.equal('Newbie123');
      expect(isHashed(stored.password)).to.equal(true);
    });

    it('rejects a duplicate username regardless of case (409)', async () => {
      const res = await api().post('/api/users').send({ ...valid, username: 'BOBBY' });

      expect(res.status).to.equal(409);
    });

    it('rejects invalid input with a helpful message (400)', async () => {
      const cases = [
        [{ ...valid, username: 'ab' }, /3-50 characters/],
        [{ ...valid, password: 'weakpass' }, /uppercase/],
        [{ ...valid, age: 5 }, /between 13 and 120/],
        [{ ...valid, role: 'god' }, /Role must be/]
      ];

      for (const [body, message] of cases) {
        const res = await api().post('/api/users').send(body);

        expect(res.status, JSON.stringify(body)).to.equal(400);
        expect(res.body.message).to.match(message);
      }
    });

    it('does not let anyone sign themselves up as an admin (403)', async () => {
      const res = await api()
        .post('/api/users')
        .send({ ...valid, role: 'superAdmin' });

      expect(res.status).to.equal(403);
    });

    it('lets the Super Admin create admin accounts', async () => {
      const res = await api()
        .post('/api/users')
        .send({ ...valid, role: 'groupAdmin', requesterId: 1 });

      expect(res.status).to.equal(201);
      expect(res.body.role).to.equal('groupAdmin');
    });

    it('records the new account in the audit log', async () => {
      await api().post('/api/users').send(valid);

      const entry = await db().collection('audit').findOne({ action: 'user.created' });

      expect(entry.details.username).to.equal('newbie');
    });
  });

  describe('DELETE /api/users/:id', () => {

    it('only the Super Admin can delete users (403)', async () => {
      const res = await api().delete('/api/users/3?requesterId=2');

      expect(res.status).to.equal(403);
    });

    it('removes the user and their group/channel memberships', async () => {
      const res = await api().delete('/api/users/3?requesterId=1');

      expect(res.status).to.equal(200);
      expect(await db().collection('users').findOne({ id: 3 })).to.equal(null);
      expect(await db().collection('groups').countDocuments({ memberIds: 3 })).to.equal(0);
      expect(await db().collection('channels').countDocuments({ memberIds: 3 })).to.equal(0);
    });

    it('returns 404 for an unknown user', async () => {
      const res = await api().delete('/api/users/99?requesterId=1');

      expect(res.status).to.equal(404);
    });
  });

  describe('GET /api/audit', () => {

    it('is only visible to the Super Admin', async () => {
      const denied = await api().get('/api/audit?requesterId=3');
      const allowed = await api().get('/api/audit?requesterId=1');

      expect(denied.status).to.equal(403);
      expect(allowed.status).to.equal(200);
    });

    it('lists the newest entry first', async () => {
      await api().post('/api/users').send({ username: 'first', password: 'First1234', age: 20 });
      await api().post('/api/users').send({ username: 'second', password: 'Second123', age: 20 });

      const res = await api().get('/api/audit?requesterId=1');

      expect(res.body[0].details.username).to.equal('second');
      expect(res.body[1].details.username).to.equal('first');
    });
  });
});
