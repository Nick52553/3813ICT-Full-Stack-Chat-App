const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const {
  connectDb,
  getDb,
  getNextId: getNextDbId
} = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ====================================================
// DATA FILES
// ====================================================

const DATA_DIR = path.join(
  __dirname,
  'DATA FOR THE APP PHASE 1'
);

const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');

// ====================================================
// HELPER FUNCTIONS
// ====================================================

function readJson(file) {
  try {
    return JSON.parse(
      fs.readFileSync(file, 'utf8')
    );
  } catch (error) {
    console.error(`Error reading ${file}:`, error.message);
    return [];
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(
      file,
      JSON.stringify(data, null, 2),
      'utf8'
    );
    return true;
  } catch (error) {
    console.error(`Error writing ${file}:`, error.message);
    return false;
  }
}

function getNextId(items) {
  if (!items.length) {
    return 1;
  }

  return Math.max(
    ...items.map(item => Number(item.id) || 0)
  ) + 1;
}

function logAudit(action, actorId, details) {

  const entries = readJson(AUDIT_FILE);

  const validEntries =
    Array.isArray(entries) ? entries : [];

  validEntries.push({
    id: getNextId(validEntries),
    action,
    actorId: actorId !== undefined && actorId !== null
      ? Number(actorId)
      : null,
    details: details || {},
    timestamp: new Date().toISOString()
  });

  writeJson(AUDIT_FILE, validEntries);
}

// ====================================================
// MONGODB USER HELPERS
// ====================================================

function usersCollection() {
  return getDb().collection('users');
}

async function getUserById(userId) {
  return usersCollection().findOne({
    id: Number(userId)
  });
}

// Never send the password or Mongo's _id to the client.
function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    age: user.age,
    role: user.role
  };
}

// Insert a new user with the next numeric id.
// Returns null if the username is already taken.
async function insertUser({ username, password, age, role }) {

  const newUser = {
    id: await getNextDbId('users'),
    username: username.trim(),
    password,
    age: Number(age) || 0,
    role
  };

  try {
    await usersCollection().insertOne(newUser);
  } catch (error) {
    // 11000 = duplicate key (unique username index)
    if (error.code === 11000) {
      return null;
    }
    throw error;
  }

  return newUser;
}

// ====================================================
// CHECK REQUEST PERMISSION
// ====================================================

function canReviewRequest(request, reviewer) {

  if (!reviewer) {
    return false;
  }

  // New group requests are ONLY handled
  // by the Super Admin.
  if (request.type === 'group') {
    return reviewer.role === 'superAdmin';
  }

  // Channel and removal requests are handled
  // by the relevant Group Admin.
  if (
    request.type === 'channel' ||
    request.type === 'ban' ||
    request.type === 'groupRemoval' ||
    request.type === 'join'
  ) {

    const groups = readJson(GROUPS_FILE);

    const group = groups.find(
      g => g.id === Number(request.groupId)
    );

    if (!group) {
      return false;
    }

    // Super Admin can review any group request.
    if (reviewer.role === 'superAdmin') {
      return true;
    }

    // Group Admin must be an admin of this group.
    if (reviewer.role !== 'groupAdmin') {
      return false;
    }

    return Array.isArray(group.adminIds) &&
      group.adminIds.includes(reviewer.id);
  }

  return false;
}

// ====================================================
// HOME
// ====================================================

app.get('/', (req, res) => {
  res.json({
    message: 'Chat application backend is running!',
    status: 'online'
  });
});

// ====================================================
// BOOTSTRAP SUPER ADMIN
// ====================================================

// Check whether the app still needs its first Super Admin.
app.get('/api/bootstrap-status', async (req, res) => {

  const superAdmin = await usersCollection().findOne({
    role: 'superAdmin'
  });

  res.json({
    needsBootstrap: !superAdmin
  });
});

// Create the first Super Admin. Only works while no
// Super Admin exists yet - locks itself out after that.
app.post('/api/bootstrap', async (req, res) => {

  const {
    username,
    password,
    age
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required'
    });
  }

  const superAdmin = await usersCollection().findOne({
    role: 'superAdmin'
  });

  if (superAdmin) {
    return res.status(403).json({
      message: 'Super Admin has already been set up'
    });
  }

  const newUser = await insertUser({
    username,
    password,
    age,
    role: 'superAdmin'
  });

  if (!newUser) {
    return res.status(409).json({
      message: 'Username already exists'
    });
  }

  logAudit('user.bootstrapped', newUser.id, {
    username: newUser.username
  });

  res.status(201).json(toSafeUser(newUser));
});

// ====================================================
// LOGIN
// ====================================================

app.post('/api/login', async (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required'
    });
  }

  const user = await usersCollection().findOne({
    username,
    password
  });

  if (!user) {
    return res.status(401).json({
      message: 'Invalid username or password'
    });
  }

  res.json(toSafeUser(user));
});

// ====================================================
// USERS
// ====================================================

// Get users
app.get('/api/users', async (req, res) => {

  const users = await usersCollection()
    .find()
    .sort({ id: 1 })
    .toArray();

  res.json(users.map(toSafeUser));
});

// Create user
app.post('/api/users', async (req, res) => {

  const {
    username,
    password,
    age,
    role
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required'
    });
  }

  const newUser = await insertUser({
    username,
    password,
    age,
    role: role || 'user'
  });

  if (!newUser) {
    return res.status(409).json({
      message: 'Username already exists'
    });
  }

  logAudit('user.created', newUser.id, {
    username: newUser.username,
    role: newUser.role
  });

  res.status(201).json(toSafeUser(newUser));
});

// ====================================================
// GROUPS
// ====================================================

// Get groups
app.get('/api/groups', (req, res) => {
  res.json(readJson(GROUPS_FILE));
});

// Get one group
app.get('/api/groups/:groupId', (req, res) => {

  const groups = readJson(GROUPS_FILE);

  const group = groups.find(
    g => g.id === Number(req.params.groupId)
  );

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  res.json(group);
});

// Create group
app.post('/api/groups', (req, res) => {

  const {
    name,
    description,
    ageLimit,
    adminIds,
    memberIds
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      message: 'Group name is required'
    });
  }

  const groups = readJson(GROUPS_FILE);

  const duplicate = groups.find(
    group =>
      group.name.toLowerCase() ===
      name.trim().toLowerCase()
  );

  if (duplicate) {
    return res.status(409).json({
      message: 'A group with that name already exists'
    });
  }

  const newGroup = {
    id: getNextId(groups),
    name: name.trim(),
    description: description || '',
    ageLimit: Number(ageLimit) || 0,
    adminIds: Array.isArray(adminIds)
      ? adminIds
      : [],
    memberIds: Array.isArray(memberIds)
      ? memberIds
      : []
  };

  groups.push(newGroup);

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not save group'
    });
  }

  res.status(201).json(newGroup);
});

// Add member to group
app.post('/api/groups/:groupId/members', async (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);

  const group = groups.find(
    g => g.id === groupId
  );

  const user = await getUserById(userId);

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  if (!group.memberIds.includes(userId)) {
    group.memberIds.push(userId);
  }

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not update group membership'
    });
  }

  res.json(group);
});

// Assign group admin
app.post('/api/groups/:groupId/admins', async (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);

  const group = groups.find(
    g => g.id === groupId
  );

  const user = await getUserById(userId);

  if (!group || !user) {
    return res.status(404).json({
      message: 'Group or user not found'
    });
  }

  if (!group.memberIds.includes(userId)) {
    group.memberIds.push(userId);
  }

  if (!group.adminIds.includes(userId)) {
    group.adminIds.push(userId);
  }

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not assign group admin'
    });
  }

  // Reflect the promotion on the user's global role,
  // unless they are already the Super Admin.
  if (user.role === 'user') {
    await usersCollection().updateOne(
      { id: userId },
      { $set: { role: 'groupAdmin' } }
    );
  }

  logAudit('group.admin.promoted', userId, {
    groupId,
    groupName: group.name,
    username: user.username
  });

  res.json(group);
});

// Demote a group admin back to a regular member
app.post('/api/groups/:groupId/admins/demote', async (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);

  const group = groups.find(
    g => g.id === groupId
  );

  const user = await getUserById(userId);

  if (!group || !user) {
    return res.status(404).json({
      message: 'Group or user not found'
    });
  }

  group.adminIds = group.adminIds.filter(
    id => id !== userId
  );

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not demote group admin'
    });
  }

  // Drop the global groupAdmin role only if this user
  // is not an admin of any other group.
  const stillAdminElsewhere = groups.some(
    g => Array.isArray(g.adminIds) && g.adminIds.includes(userId)
  );

  if (!stillAdminElsewhere && user.role === 'groupAdmin') {
    await usersCollection().updateOne(
      { id: userId },
      { $set: { role: 'user' } }
    );
  }

  logAudit('group.admin.demoted', userId, {
    groupId,
    groupName: group.name,
    username: user.username
  });

  res.json(group);
});

// ====================================================
// CHANNELS
// ====================================================

// Get all channels
app.get('/api/channels', (req, res) => {
  res.json(readJson(CHANNELS_FILE));
});

// Get group channels
app.get('/api/groups/:groupId/channels', (req, res) => {

  const groupId = Number(req.params.groupId);
  const channels = readJson(CHANNELS_FILE);

  res.json(
    channels.filter(
      channel => channel.groupId === groupId
    )
  );
});

// Create channel
app.post('/api/channels', (req, res) => {

  const {
    groupId,
    name,
    description,
    memberIds
  } = req.body;

  const numericGroupId = Number(groupId);

  if (
    !numericGroupId ||
    !name ||
    !name.trim()
  ) {
    return res.status(400).json({
      message:
        'Group ID and channel name are required'
    });
  }

  const groups = readJson(GROUPS_FILE);
  const channels = readJson(CHANNELS_FILE);

  const group = groups.find(
    g => g.id === numericGroupId
  );

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  const duplicate = channels.find(
    channel =>
      channel.groupId === numericGroupId &&
      channel.name.toLowerCase() ===
      name.trim().toLowerCase()
  );

  if (duplicate) {
    return res.status(409).json({
      message:
        'A channel with that name already exists'
    });
  }

  const newChannel = {
    id: getNextId(channels),
    groupId: numericGroupId,
    name: name.trim(),
    description: description || '',
    memberIds: Array.isArray(memberIds)
      ? memberIds
      : []
  };

  channels.push(newChannel);

  if (!writeJson(CHANNELS_FILE, channels)) {
    return res.status(500).json({
      message: 'Could not save channel'
    });
  }

  res.status(201).json(newChannel);
});

// Add user to channel
app.post('/api/channels/:channelId/members', async (req, res) => {

  const channelId = Number(req.params.channelId);
  const userId = Number(req.body.userId);

  const channels = readJson(CHANNELS_FILE);

  const channel = channels.find(
    c => c.id === channelId
  );

  const user = await getUserById(userId);

  if (!channel || !user) {
    return res.status(404).json({
      message:
        'Channel or user not found'
    });
  }

  if (!channel.memberIds.includes(userId)) {
    channel.memberIds.push(userId);
  }

  if (!writeJson(CHANNELS_FILE, channels)) {
    return res.status(500).json({
      message:
        'Could not update channel membership'
    });
  }

  res.json(channel);
});

// ====================================================
// REQUESTS
// ====================================================

// Get requests
app.get('/api/requests', async (req, res) => {

  const {
    status,
    reviewerId,
    requesterId
  } = req.query;

  const requests = readJson(REQUESTS_FILE);

  let filtered = requests;

  if (status) {
    filtered = filtered.filter(
      request =>
        request.status === status
    );
  }

  // IMPORTANT:
  // Only return requests that this reviewer
  // is actually allowed to see.
  if (reviewerId) {

    const reviewer =
      await getUserById(reviewerId);

    if (!reviewer) {
      return res.status(404).json({
        message: 'Reviewer not found'
      });
    }

    filtered = filtered.filter(
      request =>
        canReviewRequest(
          request,
          reviewer
        )
    );
  }

  if (requesterId) {

    filtered = filtered.filter(
      request =>
        request.requesterId ===
        Number(requesterId)
    );
  }

  res.json(filtered);
});

// Create request
app.post('/api/requests', async (req, res) => {

  const {
    type,
    requesterId,
    groupId,
    targetUserId,
    name,
    description,
    ageLimit,
    reason
  } = req.body;

  const requester =
    await getUserById(requesterId);

  if (!requester) {
    return res.status(404).json({
      message: 'Requesting user not found'
    });
  }

  const allowedTypes = [
    'group',
    'channel',
    'ban',
    'groupRemoval',
    'join'
  ];

  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      message: 'Invalid request type'
    });
  }

  // Group-related request validation
  if (
    type === 'channel' ||
    type === 'ban' ||
    type === 'groupRemoval' ||
    type === 'join'
  ) {

    if (groupId === undefined) {
      return res.status(400).json({
        message:
          'Group is required for this request'
      });
    }

    const groups =
      readJson(GROUPS_FILE);

    const group =
      groups.find(
        g => g.id === Number(groupId)
      );

    if (!group) {
      return res.status(404).json({
        message: 'Group not found'
      });
    }

    if (type === 'join') {

      if (
        Array.isArray(group.memberIds) &&
        group.memberIds.includes(requester.id)
      ) {
        return res.status(409).json({
          message: 'You are already a member of this group'
        });
      }

      if (
        group.ageLimit &&
        Number(requester.age) < Number(group.ageLimit)
      ) {
        return res.status(403).json({
          message:
            `You must be at least ${group.ageLimit} years old to join this group`
        });
      }
    }
  }

  // Target user validation
  if (
    type === 'ban' ||
    type === 'groupRemoval'
  ) {

    if (targetUserId === undefined) {
      return res.status(400).json({
        message: 'Target user is required'
      });
    }

    const targetUser =
      await getUserById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({
        message: 'Target user not found'
      });
    }
  }

  const requests =
    readJson(REQUESTS_FILE);

  const newRequest = {

    id:
      getNextId(requests),

    type,

    requesterId:
      Number(requesterId),

    groupId:
      groupId !== undefined
        ? Number(groupId)
        : null,

    targetUserId:
      targetUserId !== undefined
        ? Number(targetUserId)
        : null,

    name:
      name || '',

    description:
      description || '',

    ageLimit:
      Number(ageLimit) || 0,

    reason:
      reason || '',

    status:
      'pending',

    createdAt:
      new Date().toISOString(),

    reviewedAt:
      null,

    reviewedBy:
      null
  };

  requests.push(newRequest);

  if (
    !writeJson(
      REQUESTS_FILE,
      requests
    )
  ) {
    return res.status(500).json({
      message: 'Could not save request'
    });
  }

  res.status(201).json(newRequest);
});

// ====================================================
// APPROVE / DENY REQUEST
// ====================================================

app.put('/api/requests/:requestId', async (req, res) => {

  const requestId =
    Number(req.params.requestId);

  const {
    status,
    reviewerId
  } = req.body;

  if (
    status !== 'approved' &&
    status !== 'denied'
  ) {
    return res.status(400).json({
      message:
        'Status must be approved or denied'
    });
  }

  const reviewer =
    await getUserById(reviewerId);

  if (!reviewer) {
    return res.status(404).json({
      message: 'Reviewer not found'
    });
  }

  const requests =
    readJson(REQUESTS_FILE);

  const requestIndex =
    requests.findIndex(
      request =>
        request.id === requestId
    );

  if (requestIndex === -1) {
    return res.status(404).json({
      message: 'Request not found'
    });
  }

  const request =
    requests[requestIndex];

  if (request.status !== 'pending') {
    return res.status(400).json({
      message:
        'This request has already been reviewed'
    });
  }

  // IMPORTANT:
  // Verify the reviewer can actually review it.
  if (
    !canReviewRequest(
      request,
      reviewer
    )
  ) {
    return res.status(403).json({
      message:
        'You do not have permission to review this request'
    });
  }

  // --------------------------------------------------
  // DENY
  // --------------------------------------------------

  if (status === 'denied') {

    request.status = 'denied';

    request.reviewedAt =
      new Date().toISOString();

    request.reviewedBy =
      reviewer.id;

    requests[requestIndex] =
      request;

    if (
      !writeJson(
        REQUESTS_FILE,
        requests
      )
    ) {
      return res.status(500).json({
        message:
          'Could not update request'
      });
    }

    logAudit('request.denied', reviewer.id, {
      requestId: request.id,
      requestType: request.type
    });

    return res.json({
      message: 'Request denied',
      request
    });
  }

  // --------------------------------------------------
  // APPROVE
  // --------------------------------------------------

  const groups =
    readJson(GROUPS_FILE);

  const channels =
    readJson(CHANNELS_FILE);

  // --------------------------------------------------
  // APPROVE NEW GROUP
  // --------------------------------------------------

  if (request.type === 'group') {

    const duplicate =
      groups.find(
        group =>
          group.name.toLowerCase() ===
          request.name.toLowerCase()
      );

    if (duplicate) {
      return res.status(409).json({
        message:
          'A group with this name already exists'
      });
    }

    const newGroup = {

      id:
        getNextId(groups),

      name:
        request.name,

      description:
        request.description,

      ageLimit:
        request.ageLimit,

      adminIds:
        [],

      memberIds:
        [request.requesterId]
    };

    groups.push(newGroup);

    if (
      !writeJson(
        GROUPS_FILE,
        groups
      )
    ) {
      return res.status(500).json({
        message:
          'Could not create requested group'
      });
    }
  }

  // --------------------------------------------------
  // APPROVE NEW CHANNEL
  // --------------------------------------------------

  if (request.type === 'channel') {

    const group =
      groups.find(
        g =>
          g.id === request.groupId
      );

    if (!group) {
      return res.status(404).json({
        message:
          'Group for channel request not found'
      });
    }

    const duplicate =
      channels.find(
        channel =>
          channel.groupId ===
            request.groupId &&
          channel.name.toLowerCase() ===
            request.name.toLowerCase()
      );

    if (duplicate) {
      return res.status(409).json({
        message:
          'A channel with this name already exists'
      });
    }

    const newChannel = {

      id:
        getNextId(channels),

      groupId:
        request.groupId,

      name:
        request.name,

      description:
        request.description,

      // All group members get channel access
      memberIds:
        [...group.memberIds]
    };

    channels.push(newChannel);

    if (
      !writeJson(
        CHANNELS_FILE,
        channels
      )
    ) {
      return res.status(500).json({
        message:
          'Could not create requested channel'
      });
    }
  }

  // --------------------------------------------------
  // APPROVE JOIN
  // --------------------------------------------------

  if (request.type === 'join') {

    const group =
      groups.find(
        g =>
          g.id === request.groupId
      );

    if (!group) {
      return res.status(404).json({
        message:
          'Group for join request not found'
      });
    }

    if (!Array.isArray(group.memberIds)) {
      group.memberIds = [];
    }

    if (!group.memberIds.includes(request.requesterId)) {
      group.memberIds.push(request.requesterId);
    }

    if (
      !writeJson(
        GROUPS_FILE,
        groups
      )
    ) {
      return res.status(500).json({
        message:
          'Could not add user to group'
      });
    }
  }

  // --------------------------------------------------
  // APPROVE BAN / REMOVAL
  // --------------------------------------------------

  if (
    request.type === 'ban' ||
    request.type === 'groupRemoval'
  ) {

    const group =
      groups.find(
        g =>
          g.id === request.groupId
      );

    if (!group) {
      return res.status(404).json({
        message:
          'Group not found'
      });
    }

    const targetUserId =
      request.targetUserId;

    // Cannot remove the final group admin
    if (
      group.adminIds.includes(targetUserId) &&
      group.adminIds.length === 1
    ) {
      return res.status(400).json({
        message:
          'This user is the only group admin. A successor must be appointed first.'
      });
    }

    // Remove from group members
    group.memberIds =
      group.memberIds.filter(
        id =>
          id !== targetUserId
      );

    // Remove group administrator status
    group.adminIds =
      group.adminIds.filter(
        id =>
          id !== targetUserId
      );

    const groupIndex =
      groups.findIndex(
        g =>
          g.id === request.groupId
      );

    groups[groupIndex] =
      group;

    if (
      !writeJson(
        GROUPS_FILE,
        groups
      )
    ) {
      return res.status(500).json({
        message:
          'Could not remove user from group'
      });
    }

    // Remove the user from channels
    // belonging to this group.
    const updatedChannels =
      channels.map(
        channel => {

          if (
            channel.groupId ===
            request.groupId
          ) {

            return {
              ...channel,

              memberIds:
                channel.memberIds.filter(
                  id =>
                    id !== targetUserId
                )
            };
          }

          return channel;

        }
      );

    if (
      !writeJson(
        CHANNELS_FILE,
        updatedChannels
      )
    ) {
      return res.status(500).json({
        message:
          'Could not update channel memberships'
      });
    }
  }

  // --------------------------------------------------
  // MARK REQUEST APPROVED
  // --------------------------------------------------

  request.status =
    'approved';

  request.reviewedAt =
    new Date().toISOString();

  request.reviewedBy =
    reviewer.id;

  requests[requestIndex] =
    request;

  if (
    !writeJson(
      REQUESTS_FILE,
      requests
    )
  ) {
    return res.status(500).json({
      message:
        'Could not update request status'
    });
  }

  logAudit('request.approved', reviewer.id, {
    requestId: request.id,
    requestType: request.type,
    groupId: request.groupId,
    targetUserId: request.targetUserId
  });

  res.json({
    message:
      'Request approved and changes applied',
    request
  });
});

// ====================================================
// DELETE USER
// ====================================================

app.delete('/api/users/:userId', async (req, res) => {

  const userId = Number(req.params.userId);
  const requesterId = Number(req.query.requesterId);

  const requester = await getUserById(requesterId);

  if (!requester || requester.role !== 'superAdmin') {
    return res.status(403).json({
      message: 'Only the Super Admin can delete users'
    });
  }

  const target = await usersCollection().findOneAndDelete({
    id: userId
  });

  if (!target) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  // Strip the deleted user from every group and channel.
  const groups = readJson(GROUPS_FILE);

  const updatedGroups = groups.map(group => ({
    ...group,
    memberIds: (group.memberIds || []).filter(id => id !== userId),
    adminIds: (group.adminIds || []).filter(id => id !== userId)
  }));

  writeJson(GROUPS_FILE, updatedGroups);

  const channels = readJson(CHANNELS_FILE);

  const updatedChannels = channels.map(channel => ({
    ...channel,
    memberIds: (channel.memberIds || []).filter(id => id !== userId)
  }));

  writeJson(CHANNELS_FILE, updatedChannels);

  logAudit('user.deleted', requesterId, {
    deletedUserId: userId,
    deletedUsername: target.username
  });

  res.json({
    message: 'User deleted'
  });
});

// ====================================================
// AUDIT LOG
// ====================================================

app.get('/api/audit', async (req, res) => {

  const requesterId = Number(req.query.requesterId);

  const requester = await getUserById(requesterId);

  if (!requester || requester.role !== 'superAdmin') {
    return res.status(403).json({
      message: 'Only the Super Admin can view the audit log'
    });
  }

  const entries = readJson(AUDIT_FILE);

  const validEntries =
    Array.isArray(entries) ? entries : [];

  res.json(
    [...validEntries].reverse()
  );
});

// ====================================================
// START SERVER
// ====================================================

connectDb()
  .then(() => {

    app.listen(PORT, () => {

      console.log(
        `Server running on http://localhost:${PORT}`
      );

      console.log(
        `Data directory: ${DATA_DIR}`
      );

    });
  })
  .catch(error => {

    console.error(
      'Could not connect to MongoDB:',
      error.message
    );

    process.exit(1);
  });