// Integration tests: Socket.io events, using real clients
// against the real server on a random free port.

const { expect } = require('chai');
const { io: connect } = require('socket.io-client');
const { server } = require('../server');
const { api, resetDatabase } = require('./helpers');

describe('Sockets: real-time chat', () => {

  let url;
  let clients = [];

  before(done => {
    // Port 0 = let the OS pick a free port.
    server.listen(0, () => {
      url = `http://localhost:${server.address().port}`;
      done();
    });
  });

  after(done => {
    server.close(() => done());
  });

  beforeEach(resetDatabase);

  afterEach(() => {
    clients.forEach(client => client.disconnect());
    clients = [];
  });

  // A connected client that records every event it receives.
  async function newClient() {

    const client = connect(url, { transports: ['websocket'], forceNew: true });
    client.received = [];
    client.onAny((event, data) => client.received.push({ event, data }));
    clients.push(client);

    await new Promise(resolve => client.on('connect', resolve));
    return client;
  }

  // Emit an event and wait for the server's acknowledgement.
  const ask = (client, event, payload) =>
    new Promise(resolve => client.emit(event, payload, resolve));

  // Wait for a client to receive a matching event.
  function waitFor(client, event, match = () => true) {
    return new Promise((resolve, reject) => {

      const found = client.received.find(e => e.event === event && match(e.data));
      if (found) {
        return resolve(found.data);
      }

      const timer = setTimeout(() => reject(new Error(`No "${event}" event`)), 2000);

      client.on(event, function handler(data) {
        if (match(data)) {
          clearTimeout(timer);
          client.off(event, handler);
          resolve(data);
        }
      });
    });
  }

  // Give any (unexpected) events time to arrive.
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));

  async function joined(userId, channelId = 1) {
    const client = await newClient();
    const ack = await ask(client, 'joinChannel', { userId, channelId });
    expect(ack.ok, ack.message).to.equal(true);
    return client;
  }

  describe('joining and leaving', () => {

    it('members can join and get the online list', async () => {
      const bobby = await newClient();

      const ack = await ask(bobby, 'joinChannel', { userId: 3, channelId: 1 });

      expect(ack.ok).to.equal(true);
      expect(ack.users.map(u => u.username)).to.deep.equal(['bobby']);
    });

    it('non-members and unknown channels are refused', async () => {
      const outsider = await newClient();

      expect((await ask(outsider, 'joinChannel', { userId: 5, channelId: 1 })).ok).to.equal(false);
      expect((await ask(outsider, 'joinChannel', { userId: 3, channelId: 99 })).ok).to.equal(false);
    });

    it('tells others when someone joins, and updates the online list', async () => {
      const bobby = await joined(3);
      await joined(2);

      const joinedEvent = await waitFor(bobby, 'userJoined');
      const online = await waitFor(bobby, 'onlineUsers', d => d.users.length === 2);

      expect(joinedEvent.username).to.equal('ben');
      expect(online.users.map(u => u.username).sort()).to.deep.equal(['ben', 'bobby']);
    });

    it('tells others when someone leaves or disconnects', async () => {
      const bobby = await joined(3);
      const ben = await joined(2);

      ben.disconnect();

      const left = await waitFor(bobby, 'userLeft');
      expect(left.username).to.equal('ben');
    });

    it('a second tab for the same user does not announce join/leave', async () => {
      const ben = await joined(2);
      await joined(3);
      ben.received = [];

      const bobbyTab2 = await joined(3);
      bobbyTab2.disconnect();
      await settle();

      expect(ben.received.filter(e => ['userJoined', 'userLeft'].includes(e.event))).to.have.length(0);
    });
  });

  describe('messages', () => {

    it('broadcasts a sent message to everyone in the channel, including the sender', async () => {
      const bobby = await joined(3);
      const ben = await joined(2);

      const ack = await ask(bobby, 'sendMessage', { channelId: 1, text: '  hi all  ' });

      expect(ack.ok).to.equal(true);
      expect((await waitFor(ben, 'newMessage')).text).to.equal('hi all');
      expect((await waitFor(bobby, 'newMessage')).text).to.equal('hi all');
    });

    it('saves socket messages so they appear in the history', async () => {
      const bobby = await joined(3);

      await ask(bobby, 'sendMessage', { channelId: 1, text: 'persist me' });

      const history = await api().get('/api/channels/1/messages?userId=3');
      expect(history.body.map(m => m.text)).to.deep.equal(['persist me']);
    });

    it('does not leak messages into other channels', async () => {
      const bobbyInGeneral = await joined(3, 1);
      const bobbyInHomework = await joined(3, 3);

      await ask(bobbyInGeneral, 'sendMessage', { channelId: 1, text: 'general only' });
      await settle();

      expect(bobbyInHomework.received.filter(e => e.event === 'newMessage')).to.have.length(0);
    });

    it('refuses empty messages and channels you have not joined', async () => {
      const bobby = await joined(3);

      expect((await ask(bobby, 'sendMessage', { channelId: 1, text: '  ' })).ok).to.equal(false);
      expect((await ask(bobby, 'sendMessage', { channelId: 3, text: 'hi' })).ok).to.equal(false);
    });

    it('broadcasts messages sent over REST, including images', async () => {
      const ben = await joined(2);

      await api()
        .post('/api/channels/1/images')
        .field('userId', '3')
        .attach('image', require('./helpers').IMAGES.png, 'pic.png');

      const message = await waitFor(ben, 'newMessage');
      expect(message.imageUrl).to.match(/^\/uploads\/chat\//);
    });

    it('broadcasts deletions', async () => {
      const ben = await joined(2);
      const sent = await api().post('/api/channels/1/messages').send({ userId: 3, text: 'oops' });

      await api().delete(`/api/messages/${sent.body.id}?userId=3`);

      const deleted = await waitFor(ben, 'messageDeleted');
      expect(deleted.id).to.equal(sent.body.id);
    });
  });

  describe('typing and robustness', () => {

    it('shows typing to others but not to the typist', async () => {
      const bobby = await joined(3);
      const ben = await joined(2);

      bobby.emit('typing', { channelId: 1, isTyping: true });

      const typing = await waitFor(ben, 'typing');
      await settle();

      expect(typing).to.include({ username: 'bobby', isTyping: true });
      expect(bobby.received.filter(e => e.event === 'typing')).to.have.length(0);
    });

    it('survives malformed events without crashing', async () => {
      const client = await newClient();

      client.emit('joinChannel', null, () => {});
      client.emit('sendMessage');
      client.emit('typing', 'nonsense');
      await settle();

      expect(client.connected).to.equal(true);
      expect((await api().get('/api/groups')).status).to.equal(200);
    });
  });
});
