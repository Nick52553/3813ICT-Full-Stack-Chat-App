// Integration tests: user requests and the approve/deny flow.

const { expect } = require('chai');
const { api, db, resetDatabase } = require('./helpers');

// Submit a request and return its saved document.
async function submit(body) {
  const res = await api().post('/api/requests').send(body);
  expect(res.status, JSON.stringify(res.body)).to.equal(201);
  return res.body;
}

function review(requestId, reviewerId, status = 'approved') {
  return api().put(`/api/requests/${requestId}`).send({ status, reviewerId });
}

describe('API: requests', () => {

  beforeEach(resetDatabase);

  describe('creating requests', () => {

    it('saves a pending request with the next id', async () => {
      const request = await submit({ type: 'group', requesterId: 3, name: 'Chess' });

      expect(request).to.include({ id: 1, type: 'group', status: 'pending', name: 'Chess' });
    });

    it('rejects unknown types and requesters', async () => {
      expect((await api().post('/api/requests').send({ type: 'nope', requesterId: 3 })).status).to.equal(400);
      expect((await api().post('/api/requests').send({ type: 'group', requesterId: 99, name: 'X1' })).status).to.equal(404);
    });

    it('validates requests that will create something', async () => {
      const res = await api()
        .post('/api/requests')
        .send({ type: 'channel', requesterId: 3, groupId: 1, name: 'x' });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/Channel name must be 2-50/);
    });

    it('enforces a group age limit on join requests (403)', async () => {
      const res = await api()
        .post('/api/requests')
        .send({ type: 'join', requesterId: 4, groupId: 1 });

      expect(res.status).to.equal(403);
      expect(res.body.message).to.match(/at least 18/);
    });

    it('rejects joining a group you are already in (409)', async () => {
      const res = await api()
        .post('/api/requests')
        .send({ type: 'join', requesterId: 3, groupId: 1 });

      expect(res.status).to.equal(409);
    });
  });

  describe('listing requests', () => {

    beforeEach(async () => {
      await submit({ type: 'group', requesterId: 3, name: 'Chess' });
      await submit({ type: 'channel', requesterId: 3, groupId: 1, name: 'Lobby' });
      await submit({ type: 'channel', requesterId: 3, groupId: 2, name: 'Exams' });
    });

    it('filters by requester and status', async () => {
      expect((await api().get('/api/requests?requesterId=3')).body).to.have.length(3);
      expect((await api().get('/api/requests?status=approved')).body).to.have.length(0);
    });

    it('shows each reviewer only what they may review', async () => {
      const superView = await api().get('/api/requests?reviewerId=1');
      const benView = await api().get('/api/requests?reviewerId=2');
      const bobbyView = await api().get('/api/requests?reviewerId=3');

      // Super Admin: everything. Ben: only group 1's channel request.
      expect(superView.body).to.have.length(3);
      expect(benView.body.map(r => r.name)).to.deep.equal(['Lobby']);
      expect(bobbyView.body).to.have.length(0);
    });
  });

  describe('reviewing requests', () => {

    it('only the Super Admin can approve a new group', async () => {
      const request = await submit({ type: 'group', requesterId: 3, name: 'Chess' });

      expect((await review(request.id, 2)).status).to.equal(403);
      expect((await review(request.id, 1)).status).to.equal(200);

      const group = await db().collection('groups').findOne({ name: 'Chess' });
      expect(group.memberIds).to.deep.equal([3]);
    });

    it('a group admin approves a channel for their own group', async () => {
      const request = await submit({ type: 'channel', requesterId: 3, groupId: 1, name: 'Lobby' });

      const res = await review(request.id, 2);

      expect(res.status).to.equal(200);
      const channel = await db().collection('channels').findOne({ name: 'Lobby' });
      // Every group member gets access to the new channel.
      expect(channel.memberIds).to.deep.equal([2, 3]);
    });

    it('approving a join adds the user to the group', async () => {
      const request = await submit({ type: 'join', requesterId: 5, groupId: 1 });

      await review(request.id, 2);

      const group = await db().collection('groups').findOne({ id: 1 });
      expect(group.memberIds).to.include(5);
    });

    it('approving a ban removes the user from the group and its channels', async () => {
      const request = await submit({ type: 'ban', requesterId: 2, groupId: 1, targetUserId: 3, reason: 'Spam' });

      await review(request.id, 2);

      expect(await db().collection('groups').countDocuments({ id: 1, memberIds: 3 })).to.equal(0);
      expect(await db().collection('channels').countDocuments({ groupId: 1, memberIds: 3 })).to.equal(0);
      // Their group 2 channel is untouched.
      expect(await db().collection('channels').countDocuments({ id: 3, memberIds: 3 })).to.equal(1);
    });

    it('will not remove the only admin of a group', async () => {
      const request = await submit({ type: 'groupRemoval', requesterId: 1, groupId: 1, targetUserId: 2 });

      const res = await review(request.id, 1);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/only group admin/);
    });

    it('a denied request changes nothing and cannot be reviewed again', async () => {
      const request = await submit({ type: 'join', requesterId: 5, groupId: 1 });

      const denied = await review(request.id, 2, 'denied');
      const again = await review(request.id, 2, 'approved');

      expect(denied.body.request).to.include({ status: 'denied', reviewedBy: 2 });
      expect(again.status).to.equal(400);
      expect(await db().collection('groups').countDocuments({ id: 1, memberIds: 5 })).to.equal(0);
    });

    it('puts a request back to pending if it cannot be applied', async () => {
      // Valid when submitted, but "General" already exists.
      const request = await submit({ type: 'channel', requesterId: 3, groupId: 1, name: 'GENERAL' });

      const res = await review(request.id, 2);

      expect(res.status).to.equal(409);
      const saved = await db().collection('requests').findOne({ id: request.id });
      expect(saved).to.include({ status: 'pending', reviewedBy: null });
    });

    it('lets only one of two simultaneous reviews win', async () => {
      const request = await submit({ type: 'join', requesterId: 5, groupId: 1 });

      const results = await Promise.all([
        review(request.id, 1, 'approved'),
        review(request.id, 2, 'denied')
      ]);

      const statuses = results.map(r => r.status).sort();
      expect(statuses).to.deep.equal([200, 400]);
    });
  });
});
