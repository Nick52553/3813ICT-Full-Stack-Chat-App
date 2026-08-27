const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

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

const USERS_FILE = path.join(DATA_DIR, 'user.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

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

function getUserById(userId) {
  const users = readJson(USERS_FILE);

  return users.find(
    user => user.id === Number(userId)
  );
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
    request.type === 'groupRemoval'
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
// LOGIN
// ====================================================

app.post('/api/login', (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required'
    });
  }

  const users = readJson(USERS_FILE);

  const user = users.find(
    u =>
      u.username === username &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: 'Invalid username or password'
    });
  }

  res.json({
    id: user.id,
    username: user.username,
    age: user.age,
    role: user.role
  });
});

// ====================================================
// USERS
// ====================================================

// Get users
app.get('/api/users', (req, res) => {

  const users = readJson(USERS_FILE);

  const safeUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    age: user.age,
    role: user.role
  }));

  res.json(safeUsers);
});

// Create user
app.post('/api/users', (req, res) => {

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

  const users = readJson(USERS_FILE);

  const duplicate = users.find(
    user =>
      user.username.toLowerCase() ===
      username.trim().toLowerCase()
  );

  if (duplicate) {
    return res.status(409).json({
      message: 'Username already exists'
    });
  }

  const newUser = {
    id: getNextId(users),
    username: username.trim(),
    password,
    age: Number(age) || 0,
    role: role || 'user'
  };

  users.push(newUser);

  if (!writeJson(USERS_FILE, users)) {
    return res.status(500).json({
      message: 'Could not save user'
    });
  }

  res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    age: newUser.age,
    role: newUser.role
  });
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
app.post('/api/groups/:groupId/members', (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);
  const users = readJson(USERS_FILE);

  const group = groups.find(
    g => g.id === groupId
  );

  const user = users.find(
    u => u.id === userId
  );

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
app.post('/api/groups/:groupId/admins', (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);
  const users = readJson(USERS_FILE);

  const group = groups.find(
    g => g.id === groupId
  );

  const user = users.find(
    u => u.id === userId
  );

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
app.post('/api/channels/:channelId/members', (req, res) => {

  const channelId = Number(req.params.channelId);
  const userId = Number(req.body.userId);

  const channels = readJson(CHANNELS_FILE);
  const users = readJson(USERS_FILE);

  const channel = channels.find(
    c => c.id === channelId
  );

  const user = users.find(
    u => u.id === userId
  );

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
app.get('/api/requests', (req, res) => {

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
      getUserById(reviewerId);

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
app.post('/api/requests', (req, res) => {

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
    getUserById(requesterId);

  if (!requester) {
    return res.status(404).json({
      message: 'Requesting user not found'
    });
  }

  const allowedTypes = [
    'group',
    'channel',
    'ban',
    'groupRemoval'
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
    type === 'groupRemoval'
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
      getUserById(targetUserId);

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

app.put('/api/requests/:requestId', (req, res) => {

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
    getUserById(reviewerId);

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

  res.json({
    message:
      'Request approved and changes applied',
    request
  });
});

// ====================================================
// START SERVER
// ====================================================

app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

  console.log(
    `Data directory: ${DATA_DIR}`
  );

});