// Integration tests: chat messages over REST, avatars and
// chat images.

const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { api, db, resetDatabase, IMAGES } = require('./helpers');

// Where an uploaded /uploads/... URL lives on disk.
const fileFor = url =>
  path.join(process.env.UPLOAD_DIR, url.replace('/uploads/', ''));

describe('API: messages', () => {

  beforeEach(resetDatabase);

  const send = (userId, text, channelId = 1) =>
    api().post(`/api/channels/${channelId}/messages`).send({ userId, text });

  it('saves a trimmed message with the sender name', async () => {
    const res = await send(3, '  hello  ');

    expect(res.status).to.equal(201);
    expect(res.body).to.include({ id: 1, channelId: 1, userId: 3, username: 'bobby', text: 'hello', imageUrl: null });
  });

  it('returns history oldest-first, limited to the newest N', async () => {
    for (const text of ['one', 'two', 'three']) {
      await send(3, text);
    }

    const all = await api().get('/api/channels/1/messages?userId=3');
    const latestTwo = await api().get('/api/channels/1/messages?userId=3&limit=2');

    expect(all.body.map(m => m.text)).to.deep.equal(['one', 'two', 'three']);
    expect(latestTwo.body.map(m => m.text)).to.deep.equal(['two', 'three']);
  });

  it('keeps non-members out of a channel (403)', async () => {
    expect((await send(5, 'let me in')).status).to.equal(403);
    expect((await api().get('/api/channels/1/messages?userId=5')).status).to.equal(403);
  });

  it('lets group admins and the Super Admin read without being members', async () => {
    // Take Ben (group 1's admin) out of channel 1's member list.
    await db().collection('channels').updateOne({ id: 1 }, { $pull: { memberIds: 2 } });

    expect((await api().get('/api/channels/1/messages?userId=2')).status).to.equal(200);
    expect((await api().get('/api/channels/1/messages?userId=1')).status).to.equal(200);
  });

  it('rejects empty and over-long messages (400)', async () => {
    expect((await send(3, '   ')).status).to.equal(400);
    expect((await send(3, 'a'.repeat(2001))).status).to.equal(400);
  });

  describe('deleting', () => {

    beforeEach(async () => {
      await send(3, 'bobby wrote this');
    });

    it('lets the sender delete their own message', async () => {
      expect((await api().delete('/api/messages/1?userId=3')).status).to.equal(200);
      expect(await db().collection('messages').countDocuments()).to.equal(0);
    });

    it("stops other members deleting someone else's message (403)", async () => {
      await db().collection('channels').updateOne({ id: 1 }, { $push: { memberIds: 5 } });

      expect((await api().delete('/api/messages/1?userId=5')).status).to.equal(403);
    });

    it('lets a group admin moderate, and logs it in the audit log', async () => {
      expect((await api().delete('/api/messages/1?userId=2')).status).to.equal(200);

      const entry = await db().collection('audit').findOne({ action: 'message.deleted' });
      expect(entry).to.include({ actorId: 2 });
    });
  });
});

describe('API: images', () => {

  beforeEach(resetDatabase);

  describe('avatars', () => {

    const upload = (userId, requesterId, buffer = IMAGES.png, name = 'me.png') =>
      api()
        .post(`/api/users/${userId}/avatar`)
        .field('requesterId', String(requesterId))
        .attach('avatar', buffer, name);

    it('uploads a PNG, stores its URL and serves the file', async () => {
      const res = await upload(3, 3);

      expect(res.status).to.equal(200);
      expect(res.body.avatarUrl).to.match(/^\/uploads\/avatars\/.+\.png$/);

      const file = await api().get(res.body.avatarUrl);
      expect(file.status).to.equal(200);
      expect(file.headers['content-type']).to.equal('image/png');
    });

    it('accepts JPG and GIF, and deletes the old file when replaced', async () => {
      const first = await upload(3, 3, IMAGES.jpg, 'a.jpg');
      const second = await upload(3, 3, IMAGES.gif, 'b.gif');

      expect(first.body.avatarUrl).to.match(/\.jpg$/);
      expect(second.body.avatarUrl).to.match(/\.gif$/);
      expect(fs.existsSync(fileFor(first.body.avatarUrl))).to.equal(false);
    });

    it('checks the file contents, not the file name (400)', async () => {
      const res = await upload(3, 3, IMAGES.fake, 'virus.png');

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/Only PNG, JPG and GIF/);
    });

    it('rejects files over 2MB (400)', async () => {
      const huge = Buffer.concat([IMAGES.png, Buffer.alloc(2 * 1024 * 1024)]);

      const res = await upload(3, 3, huge);

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/2MB/);
    });

    it("only allows changing your own avatar, unless you're the Super Admin", async () => {
      expect((await upload(2, 3)).status).to.equal(403);
      expect((await upload(2, 1)).status).to.equal(200);
    });

    it('removes an avatar and its file', async () => {
      const { body } = await upload(3, 3);

      const res = await api().delete('/api/users/3/avatar?requesterId=3');

      expect(res.body.avatarUrl).to.equal(null);
      expect(fs.existsSync(fileFor(body.avatarUrl))).to.equal(false);
    });
  });

  describe('chat images', () => {

    const sendImage = (userId, caption, buffer = IMAGES.png) =>
      api()
        .post('/api/channels/1/images')
        .field('userId', String(userId))
        .field('text', caption)
        .attach('image', buffer, 'pic.png');

    it('saves an image message with an optional caption', async () => {
      const res = await sendImage(3, '  look  ');

      expect(res.status).to.equal(201);
      expect(res.body.text).to.equal('look');
      expect(res.body.imageUrl).to.match(/^\/uploads\/chat\//);
    });

    it('rejects non-members without saving a file', async () => {
      const before = fs.readdirSync(process.env.UPLOAD_DIR, { recursive: true }).length;

      const res = await sendImage(5, '');

      expect(res.status).to.equal(403);
      expect(fs.readdirSync(process.env.UPLOAD_DIR, { recursive: true }).length).to.equal(before);
    });

    it('deletes the file when its message is deleted', async () => {
      const { body } = await sendImage(3, '');

      await api().delete(`/api/messages/${body.id}?userId=3`);

      expect(fs.existsSync(fileFor(body.imageUrl))).to.equal(false);
    });
  });
});
