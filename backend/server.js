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
// MONGODB GROUP HELPERS
// ====================================================

// Leave Mongo's internal _id out of documents
// sent back to the client.
const WITHOUT_MONGO_ID = {
  projection: { _id: 0 }
};

function groupsCollection() {
  return getDb().collection('groups');
}

async function getGroupById(groupId) {
  return groupsCollection().findOne(
    { id: Number(groupId) },
    WITHOUT_MONGO_ID
  );
}

// Insert a new group with the next numeric id.
// Returns null if the group name is already taken.
async function insertGroup({ name, description, ageLimit, adminIds, memberIds }) {

  const newGroup = {
    id: await getNextDbId('groups'),
    name: name.trim(),
    description: description || '',
    ageLimit: Number(ageLimit) || 0,
    adminIds: Array.isArray(adminIds) ? adminIds.map(Number) : [],
    memberIds: Array.isArray(memberIds) ? memberIds.map(Number) : []
  };

  try {
    await groupsCollection().insertOne(newGroup);
  } catch (error) {
    // 11000 = duplicate key (unique group name index)
    if (error.code === 11000) {
      return null;
    }
    throw error;
  }

  // insertOne adds _id to the object - strip it.
  delete newGroup._id;

  return newGroup;
}

// ====================================================
// MONGODB CHANNEL HELPERS
// ====================================================

function channelsCollection() {
  return getDb().collection('channels');
}

// Insert a new channel with the next numeric id.
// Returns null if the group already has a channel
// with that name.
async function insertChannel({ groupId, name, description, memberIds }) {

  const newChannel = {
    id: await getNextDbId('channels'),
    groupId: Number(groupId),
    name: name.trim(),
    description: description || '',
    memberIds: Array.isArray(memberIds) ? memberIds.map(Number) : []
  };

  try {
    await channelsCollection().insertOne(newChannel);
  } catch (error) {
    // 11000 = duplicate key (unique groupId + name index)
    if (error.code === 11000) {
      return null;
    }
    throw error;
  }

  delete newChannel._id;

  return newChannel;
}

// ====================================================
// MONGODB REQUEST HELPERS
// ====================================================

function requestsCollection() {
  return getDb().collection('requests');
}

// ====================================================
// CHECK REQUEST PERMISSION
// ====================================================

async function canReviewRequest(request, reviewer) {

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

    const group = await getGroupById(request.groupId);

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
app.get('/api/groups', async (req, res) => {

  const groups = await groupsCollection()
    .find({}, WITHOUT_MONGO_ID)
    .sort({ id: 1 })
    .toArray();

  res.json(groups);
});

// Get one group
app.get('/api/groups/:groupId', async (req, res) => {

  const group = await getGroupById(req.params.groupId);

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  res.json(group);
});

// Create group
app.post('/api/groups', async (req, res) => {

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

  const newGroup = await insertGroup({
    name,
    description,
    ageLimit,
    adminIds,
    memberIds
  });

  if (!newGroup) {
    return res.status(409).json({
      message: 'A group with that name already exists'
    });
  }

  res.status(201).json(newGroup);
});

// Add member to group
app.post('/api/groups/:groupId/members', async (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const user = await getUserById(userId);

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  const group = await groupsCollection().findOneAndUpdate(
    { id: groupId },
    { $addToSet: { memberIds: userId } },
    { returnDocument: 'after', ...WITHOUT_MONGO_ID }
  );

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  res.json(group);
});

// Assign group admin
app.post('/api/groups/:groupId/admins', async (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const user = await getUserById(userId);

  if (!user) {
    return res.status(404).json({
      message: 'Group or user not found'
    });
  }

  // Admins are always members too.
  const group = await groupsCollection().findOneAndUpdate(
    { id: groupId },
    {
      $addToSet: {
        memberIds: userId,
        adminIds: userId
      }
    },
    { returnDocument: 'after', ...WITHOUT_MONGO_ID }
  );

  if (!group) {
    return res.status(404).json({
      message: 'Group or user not found'
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

  const user = await getUserById(userId);

  if (!user) {
    return res.status(404).json({
      message: 'Group or user not found'
    });
  }

  const group = await groupsCollection().findOneAndUpdate(
    { id: groupId },
    { $pull: { adminIds: userId } },
    { returnDocument: 'after', ...WITHOUT_MONGO_ID }
  );

  if (!group) {
    return res.status(404).json({
      message: 'Group or user not found'
    });
  }

  // Drop the global groupAdmin role only if this user
  // is not an admin of any other group.
  // (Matching a value against an array field checks
  // whether the array contains it.)
  const stillAdminElsewhere = await groupsCollection().findOne({
    adminIds: userId
  });

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
app.get('/api/channels', async (req, res) => {

  const channels = await channelsCollection()
    .find({}, WITHOUT_MONGO_ID)
    .sort({ id: 1 })
    .toArray();

  res.json(channels);
});

// Get group channels
app.get('/api/groups/:groupId/channels', async (req, res) => {

  const channels = await channelsCollection()
    .find(
      { groupId: Number(req.params.groupId) },
      WITHOUT_MONGO_ID
    )
    .sort({ id: 1 })
    .toArray();

  res.json(channels);
});

// Create channel
app.post('/api/channels', async (req, res) => {

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

  const group = await getGroupById(numericGroupId);

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  const newChannel = await insertChannel({
    groupId: numericGroupId,
    name,
    description,
    memberIds
  });

  if (!newChannel) {
    return res.status(409).json({
      message:
        'A channel with that name already exists'
    });
  }

  res.status(201).json(newChannel);
});

// Add user to channel
app.post('/api/channels/:channelId/members', async (req, res) => {

  const channelId = Number(req.params.channelId);
  const userId = Number(req.body.userId);

  const user = await getUserById(userId);

  if (!user) {
    return res.status(404).json({
      message:
        'Channel or user not found'
    });
  }

  const channel = await channelsCollection().findOneAndUpdate(
    { id: channelId },
    { $addToSet: { memberIds: userId } },
    { returnDocument: 'after', ...WITHOUT_MONGO_ID }
  );

  if (!channel) {
    return res.status(404).json({
      message:
        'Channel or user not found'
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

  // Let MongoDB do the simple filtering.
  const query = {};

  if (status) {
    query.status = status;
  }

  if (requesterId) {
    query.requesterId = Number(requesterId);
  }

  let filtered = await requestsCollection()
    .find(query, WITHOUT_MONGO_ID)
    .sort({ id: 1 })
    .toArray();

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

    // canReviewRequest is async, so resolve every
    // check first - a pending Promise is always truthy.
    const allowed = await Promise.all(
      filtered.map(
        request =>
          canReviewRequest(
            request,
            reviewer
          )
      )
    );

    filtered = filtered.filter(
      (_request, index) => allowed[index]
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

    const group =
      await getGroupById(groupId);

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

  const newRequest = {

    id:
      await getNextDbId('requests'),

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

  await requestsCollection().insertOne(newRequest);

  // insertOne adds _id to the object - strip it.
  delete newRequest._id;

  res.status(201).json(newRequest);
});

// ====================================================
// APPROVE / DENY REQUEST
// ====================================================

// Apply the changes an approved request asks for.
// Returns null on success, or { status, message }
// describing why it could not be applied.
async function applyApprovedRequest(request) {

  // --------------------------------------------------
  // APPROVE NEW GROUP
  // --------------------------------------------------

  if (request.type === 'group') {

    const newGroup = await insertGroup({
      name: request.name,
      description: request.description,
      ageLimit: request.ageLimit,
      adminIds: [],
      memberIds: [request.requesterId]
    });

    if (!newGroup) {
      return {
        status: 409,
        message: 'A group with this name already exists'
      };
    }
  }

  // --------------------------------------------------
  // APPROVE NEW CHANNEL
  // --------------------------------------------------

  if (request.type === 'channel') {

    const group =
      await getGroupById(request.groupId);

    if (!group) {
      return {
        status: 404,
        message: 'Group for channel request not found'
      };
    }

    const newChannel = await insertChannel({
      groupId: request.groupId,
      name: request.name,
      description: request.description,
      // All group members get channel access
      memberIds: group.memberIds
    });

    if (!newChannel) {
      return {
        status: 409,
        message: 'A channel with this name already exists'
      };
    }
  }

  // --------------------------------------------------
  // APPROVE JOIN
  // --------------------------------------------------

  if (request.type === 'join') {

    const result =
      await groupsCollection().updateOne(
        { id: request.groupId },
        { $addToSet: { memberIds: request.requesterId } }
      );

    if (result.matchedCount === 0) {
      return {
        status: 404,
        message: 'Group for join request not found'
      };
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
      await getGroupById(request.groupId);

    if (!group) {
      return {
        status: 404,
        message: 'Group not found'
      };
    }

    const targetUserId =
      request.targetUserId;

    // Cannot remove the final group admin
    if (
      group.adminIds.includes(targetUserId) &&
      group.adminIds.length === 1
    ) {
      return {
        status: 400,
        message:
          'This user is the only group admin. A successor must be appointed first.'
      };
    }

    // Remove from group members and admins
    await groupsCollection().updateOne(
      { id: request.groupId },
      {
        $pull: {
          memberIds: targetUserId,
          adminIds: targetUserId
        }
      }
    );

    // Remove the user from channels
    // belonging to this group.
    await channelsCollection().updateMany(
      { groupId: request.groupId },
      { $pull: { memberIds: targetUserId } }
    );
  }

  return null;
}

// Undo a review claim so the request can be tried again.
async function revertToPending(requestId) {
  await requestsCollection().updateOne(
    { id: requestId },
    {
      $set: {
        status: 'pending',
        reviewedAt: null,
        reviewedBy: null
      }
    }
  );
}

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

  const request =
    await requestsCollection().findOne(
      { id: requestId },
      WITHOUT_MONGO_ID
    );

  if (!request) {
    return res.status(404).json({
      message: 'Request not found'
    });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({
      message:
        'This request has already been reviewed'
    });
  }

  // IMPORTANT:
  // Verify the reviewer can actually review it.
  if (
    !(await canReviewRequest(
      request,
      reviewer
    ))
  ) {
    return res.status(403).json({
      message:
        'You do not have permission to review this request'
    });
  }

  // Claim the request. The filter only matches while it
  // is still pending, so if two admins review at the same
  // moment, only one of them gets it.
  const reviewed =
    await requestsCollection().findOneAndUpdate(
      { id: requestId, status: 'pending' },
      {
        $set: {
          status,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewer.id
        }
      },
      { returnDocument: 'after', ...WITHOUT_MONGO_ID }
    );

  if (!reviewed) {
    return res.status(400).json({
      message:
        'This request has already been reviewed'
    });
  }

  // --------------------------------------------------
  // DENY
  // --------------------------------------------------

  if (status === 'denied') {

    logAudit('request.denied', reviewer.id, {
      requestId: reviewed.id,
      requestType: reviewed.type
    });

    return res.json({
      message: 'Request denied',
      request: reviewed
    });
  }

  // --------------------------------------------------
  // APPROVE
  // --------------------------------------------------

  // If the changes can't be applied, put the request
  // back to pending so it can be reviewed again.
  let failure;

  try {
    failure = await applyApprovedRequest(reviewed);
  } catch (error) {
    await revertToPending(requestId);
    throw error;
  }

  if (failure) {
    await revertToPending(requestId);

    return res.status(failure.status).json({
      message: failure.message
    });
  }

  logAudit('request.approved', reviewer.id, {
    requestId: reviewed.id,
    requestType: reviewed.type,
    groupId: reviewed.groupId,
    targetUserId: reviewed.targetUserId
  });

  res.json({
    message:
      'Request approved and changes applied',
    request: reviewed
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
  await groupsCollection().updateMany(
    {},
    {
      $pull: {
        memberIds: userId,
        adminIds: userId
      }
    }
  );

  await channelsCollection().updateMany(
    {},
    { $pull: { memberIds: userId } }
  );

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