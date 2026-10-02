// Integration tests: groups and channels.

const { expect } = require('chai');
const { api, db, resetDatabase } = require('./helpers');

describe('API: groups', () => {

  beforeEach(resetDatabase);

  it('lists groups in id order without Mongo _id', async () => {
    const res = await api().get('/api/groups');

    expect(res.status).to.equal(200);
    expect(res.body.map(g => g.id)).to.deep.equal([1, 2]);
    expect(res.body[0]).to.not.have.property('_id');
  });

  it('gets one group, or 404', async () => {
    expect((await api().get('/api/groups/1')).body.name).to.equal('Gaming');
    expect((await api().get('/api/groups/99')).status).to.equal(404);
  });

  it('creates a group with trimmed name and numeric age limit', async () => {
    const res = await api()
      .post('/api/groups')
      .send({ name: '  Music  ', description: 'Bands', ageLimit: '16' });

    expect(res.status).to.equal(201);
    expect(res.body).to.include({ id: 3, name: 'Music', ageLimit: 16 });
  });

  it('rejects a duplicate group name regardless of case (409)', async () => {
    const res = await api().post('/api/groups').send({ name: 'GAMING' });

    expect(res.status).to.equal(409);
  });

  it('validates group input (400)', async () => {
    expect((await api().post('/api/groups').send({ name: 'x' })).status).to.equal(400);
    expect((await api().post('/api/groups').send({ name: 'Old', ageLimit: 500 })).status).to.equal(400);
  });

  it('adds a member only once', async () => {
    await api().post('/api/groups/2/members').send({ userId: 5 });
    const res = await api().post('/api/groups/2/members').send({ userId: 5 });

    expect(res.body.memberIds.filter(id => id === 5)).to.have.length(1);
  });

  it('promoting an admin also makes them a member and a groupAdmin', async () => {
    const res = await api().post('/api/groups/2/admins').send({ userId: 5 });

    expect(res.body.adminIds).to.include(5);
    expect(res.body.memberIds).to.include(5);

    const user = await db().collection('users').findOne({ id: 5 });
    expect(user.role).to.equal('groupAdmin');
  });

  it('demoting the last group a user admins resets their role', async () => {
    await api().post('/api/groups/2/admins').send({ userId: 5 });
    await api().post('/api/groups/2/admins/demote').send({ userId: 5 });

    const user = await db().collection('users').findOne({ id: 5 });
    expect(user.role).to.equal('user');
  });

  it('keeps the groupAdmin role while they still admin another group', async () => {
    await api().post('/api/groups/2/admins').send({ userId: 2 });
    await api().post('/api/groups/2/admins/demote').send({ userId: 2 });

    const ben = await db().collection('users').findOne({ id: 2 });
    expect(ben.role).to.equal('groupAdmin');
  });
});

describe('API: channels', () => {

  beforeEach(resetDatabase);

  it('lists channels for one group', async () => {
    const res = await api().get('/api/groups/1/channels');

    expect(res.body.map(c => c.name)).to.deep.equal(['General', 'Raids']);
  });

  it('creates a channel in an existing group', async () => {
    const res = await api()
      .post('/api/channels')
      .send({ groupId: 2, name: 'Exams', description: 'Revision' });

    expect(res.status).to.equal(201);
    expect(res.body).to.include({ id: 4, groupId: 2, name: 'Exams' });
  });

  it('allows the same channel name in different groups only', async () => {
    const sameGroup = await api().post('/api/channels').send({ groupId: 1, name: 'general' });
    const otherGroup = await api().post('/api/channels').send({ groupId: 2, name: 'General' });

    expect(sameGroup.status).to.equal(409);
    expect(otherGroup.status).to.equal(201);
  });

  it('rejects a missing group (400) or unknown group (404)', async () => {
    expect((await api().post('/api/channels').send({ name: 'Lobby' })).status).to.equal(400);
    expect((await api().post('/api/channels').send({ groupId: 99, name: 'Lobby' })).status).to.equal(404);
  });

  it('adds a channel member only once, or 404 for unknown ids', async () => {
    await api().post('/api/channels/2/members').send({ userId: 3 });
    const res = await api().post('/api/channels/2/members').send({ userId: 3 });

    expect(res.body.memberIds).to.deep.equal([2, 3]);
    expect((await api().post('/api/channels/99/members').send({ userId: 3 })).status).to.equal(404);
    expect((await api().post('/api/channels/2/members').send({ userId: 99 })).status).to.equal(404);
  });
});
