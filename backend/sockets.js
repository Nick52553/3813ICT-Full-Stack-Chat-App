// ====================================================
// SOCKET.IO - REAL-TIME CHAT
// ====================================================
//
// Client -> server events
//   joinChannel  { userId, channelId }   (ack)
//   leaveChannel { channelId }
//   sendMessage  { channelId, text }     (ack)
//   typing       { channelId, isTyping }
//
// Server -> client events (sent to everyone in the channel room)
//   newMessage     message document
//   messageDeleted { id, channelId }
//   userJoined     { channelId, userId, username, timestamp }
//   userLeft       { channelId, userId, username, timestamp }
//   onlineUsers    { channelId, users: [{ id, username }] }
//   typing         { channelId, userId, username, isTyping }
//
// Every ack callback receives either { ok: true, ... }
// or { ok: false, message }.

// Each channel gets its own Socket.io room.
function channelRoom(channelId) {
  return `channel:${Number(channelId)}`;
}

// The unique users (not sockets - one user may have
// several tabs open) currently in a channel room.
async function getOnlineUsers(io, channelId) {

  const sockets = await io
    .in(channelRoom(channelId))
    .fetchSockets();

  const users = new Map();

  for (const socket of sockets) {
    const user = socket.data.user;
    if (user) {
      users.set(user.id, { id: user.id, username: user.username });
    }
  }

  return [...users.values()];
}

async function broadcastOnlineUsers(io, channelId) {
  io.to(channelRoom(channelId)).emit('onlineUsers', {
    channelId: Number(channelId),
    users: await getOnlineUsers(io, channelId)
  });
}

// Tell the room someone left - but only once their last
// socket has gone, so closing one of two tabs is silent.
async function announceLeave(io, socket, channelId) {

  const user = socket.data.user;

  if (!user) {
    return;
  }

  const stillHere = (await getOnlineUsers(io, channelId))
    .some(u => u.id === user.id);

  if (!stillHere) {
    io.to(channelRoom(channelId)).emit('userLeft', {
      channelId: Number(channelId),
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString()
    });
  }

  await broadcastOnlineUsers(io, channelId);
}

// Channel ids this socket has joined (skips the
// private room Socket.io gives every socket).
function joinedChannelIds(socket) {
  return [...socket.rooms]
    .filter(room => room.startsWith('channel:'))
    .map(room => Number(room.slice('channel:'.length)));
}

// Run a handler, turning any thrown error into a
// failed ack so one bad event can't crash the server.
function safely(handler) {
  return async (payload, ack) => {

    const reply = typeof ack === 'function' ? ack : () => {};

    try {
      await handler(payload || {}, reply);
    } catch (error) {
      console.error('Socket handler error:', error.message);
      reply({ ok: false, message: 'Something went wrong' });
    }
  };
}

// helpers come from server.js so sockets and REST share
// one set of rules:
//   loadChannelAccess(userId, channelId) -> { user, channel } | { error }
//   saveMessage(user, channel, text)     -> { message } | { error }
function setupSockets(io, { loadChannelAccess, saveMessage }) {

  io.on('connection', socket => {

    // ------------------------------------------------
    // JOIN A CHANNEL
    // ------------------------------------------------

    socket.on('joinChannel', safely(async ({ userId, channelId }, ack) => {

      const { user, channel, error } =
        await loadChannelAccess(userId, channelId);

      if (error) {
        return ack({ ok: false, message: error.message });
      }

      const room = channelRoom(channel.id);

      if (socket.rooms.has(room)) {
        return ack({ ok: true, users: await getOnlineUsers(io, channel.id) });
      }

      // Was this user already here in another tab?
      const alreadyOnline = (await getOnlineUsers(io, channel.id))
        .some(u => u.id === user.id);

      socket.data.user = {
        id: user.id,
        username: user.username
      };

      socket.join(room);

      if (!alreadyOnline) {
        // Everyone else in the room, not the joiner.
        socket.to(room).emit('userJoined', {
          channelId: channel.id,
          userId: user.id,
          username: user.username,
          timestamp: new Date().toISOString()
        });
      }

      await broadcastOnlineUsers(io, channel.id);

      ack({ ok: true, users: await getOnlineUsers(io, channel.id) });
    }));

    // ------------------------------------------------
    // LEAVE A CHANNEL
    // ------------------------------------------------

    socket.on('leaveChannel', safely(async ({ channelId }, ack) => {

      const room = channelRoom(channelId);

      if (!socket.rooms.has(room)) {
        return ack({ ok: true });
      }

      socket.leave(room);

      await announceLeave(io, socket, channelId);

      ack({ ok: true });
    }));

    // ------------------------------------------------
    // SEND A MESSAGE
    // ------------------------------------------------

    socket.on('sendMessage', safely(async ({ channelId, text }, ack) => {

      // The sender must have joined the room first, which
      // is where their access was checked.
      if (!socket.data.user || !socket.rooms.has(channelRoom(channelId))) {
        return ack({ ok: false, message: 'Join the channel before sending messages' });
      }

      // Re-check access: they may have been removed from
      // the channel since joining.
      const { user, channel, error } =
        await loadChannelAccess(socket.data.user.id, channelId);

      if (error) {
        return ack({ ok: false, message: error.message });
      }

      const result = await saveMessage(user, channel, text);

      if (result.error) {
        return ack({ ok: false, message: result.error.message });
      }

      // Everyone in the room, including the sender.
      io.to(channelRoom(channel.id)).emit('newMessage', result.message);

      ack({ ok: true, message: result.message });
    }));

    // ------------------------------------------------
    // TYPING INDICATOR
    // ------------------------------------------------

    socket.on('typing', safely(async ({ channelId, isTyping }) => {

      const room = channelRoom(channelId);

      if (!socket.data.user || !socket.rooms.has(room)) {
        return;
      }

      socket.to(room).emit('typing', {
        channelId: Number(channelId),
        userId: socket.data.user.id,
        username: socket.data.user.username,
        isTyping: Boolean(isTyping)
      });
    }));

    // ------------------------------------------------
    // DISCONNECT (closed tab, lost connection)
    // ------------------------------------------------

    // "disconnecting" fires while socket.rooms is still
    // filled in, so we know which channels to notify.
    socket.on('disconnecting', () => {

      const channelIds = joinedChannelIds(socket);

      // Wait until the socket has actually left its rooms,
      // otherwise it would still count as online.
      socket.once('disconnect', () => {
        for (const channelId of channelIds) {
          announceLeave(io, socket, channelId).catch(error =>
            console.error('Socket leave error:', error.message)
          );
        }
      });
    });
  });
}

module.exports = {
  setupSockets,
  channelRoom
};
