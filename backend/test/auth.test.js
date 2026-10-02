// Integration tests: login and first-run bootstrap.

const { expect } = require('chai');
const { api, db, resetDatabase, USERS } = require('./helpers');

describe('API: login', () => {

  beforeEach(resetDatabase);

  it('logs in with the right username and password', async () => {
    const res = await api()
      .post('/api/login')
      .send({ username: 'bobby', password: USERS.bobby.password });

    expect(res.status).to.equal(200);
    expect(res.body).to.include({ id: 3, username: 'bobby', role: 'user' });
  });

  it('never returns the password or its hash', async () => {
    const res = await api()
      .post('/api/login')
      .send({ username: 'bobby', password: USERS.bobby.password });

    expect(res.body).to.not.have.property('password');
    expect(res.body).to.not.have.property('_id');
  });

  it('rejects a wrong password with 401', async () => {
    const res = await api()
      .post('/api/login')
      .send({ username: 'bobby', password: 'Wrong123' });

    expect(res.status).to.equal(401);
    expect(res.body.message).to.equal('Invalid username or password');
  });

  it('gives the same 401 for an unknown user (no username probing)', async () => {
    const res = await api()
      .post('/api/login')
      .send({ username: 'nobody', password: 'Whatever1' });

    expect(res.status).to.equal(401);
    expect(res.body.message).to.equal('Invalid username or password');
  });

  it('rejects missing fields with 400', async () => {
    const res = await api().post('/api/login').send({ username: 'bobby' });

    expect(res.status).to.equal(400);
  });

  it('blocks NoSQL injection via Mongo operators', async () => {
    const res = await api()
      .post('/api/login')
      .send({ username: { $ne: '' }, password: { $ne: '' } });

    expect(res.status).to.equal(400);
  });
});

describe('API: bootstrap (first Super Admin)', () => {

  beforeEach(resetDatabase);

  it('reports that set-up is done when a Super Admin exists', async () => {
    const res = await api().get('/api/bootstrap-status');

    expect(res.body).to.deep.equal({ needsBootstrap: false });
  });

  it('refuses a second Super Admin with 403', async () => {
    const res = await api()
      .post('/api/bootstrap')
      .send({ username: 'another', password: 'Another123', age: 30 });

    expect(res.status).to.equal(403);
  });

  it('creates the first Super Admin on an empty system', async () => {
    await db().collection('users').deleteMany({});

    const status = await api().get('/api/bootstrap-status');
    expect(status.body.needsBootstrap).to.equal(true);

    const res = await api()
      .post('/api/bootstrap')
      .send({ username: 'firstadmin', password: 'First1234', age: 40 });

    expect(res.status).to.equal(201);
    expect(res.body.role).to.equal('superAdmin');
  });

  it('validates bootstrap input', async () => {
    await db().collection('users').deleteMany({});

    const res = await api()
      .post('/api/bootstrap')
      .send({ username: 'firstadmin', password: 'weak', age: 40 });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.match(/at least 8/);
  });
});
