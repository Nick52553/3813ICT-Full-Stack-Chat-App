const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(
  __dirname,
  'DATA FOR THE APP PHASE 1'
);

const USERS_FILE = path.join(DATA_DIR, 'user.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
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

// ----------------------------------------------------
// HOME
// ----------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    message: 'Chat application backend is running!',
    status: 'online'
  });
});

// ----------------------------------------------------
// LOGIN
// ----------------------------------------------------

app.post('/api/login', (req, res) => {

  const { username, password } = req.body;

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

// ----------------------------------------------------
// USERS
// ----------------------------------------------------

app.get('/api/users', (req, res) => {

  const users = readJson(USERS_FILE);

  // Never send passwords to Angular
  const safeUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    age: user.age,
    role: user.role
  }));

  res.json(safeUsers);
});

// ----------------------------------------------------
// CREATE USER
// ----------------------------------------------------

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

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters'
    });
  }

  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({
      message: 'Password must contain at least one uppercase letter'
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

// ----------------------------------------------------
// GROUPS
// ----------------------------------------------------

app.get('/api/groups', (req, res) => {
  res.json(readJson(GROUPS_FILE));
});

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

// ----------------------------------------------------
// CREATE GROUP
// ----------------------------------------------------

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
    adminIds: Array.isArray(adminIds) ? adminIds : [],
    memberIds: Array.isArray(memberIds) ? memberIds : []
  };

  groups.push(newGroup);

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not save group'
    });
  }

  res.status(201).json(newGroup);
});

// ----------------------------------------------------
// UPDATE GROUP
// ----------------------------------------------------

app.put('/api/groups/:groupId', (req, res) => {

  const groups = readJson(GROUPS_FILE);

  const index = groups.findIndex(
    g => g.id === Number(req.params.groupId)
  );

  if (index === -1) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  const group = groups[index];

  // Group name is deliberately not changed here
  if (req.body.description !== undefined) {
    group.description = req.body.description;
  }

  if (req.body.ageLimit !== undefined) {
    group.ageLimit = Number(req.body.ageLimit) || 0;
  }

  if (Array.isArray(req.body.adminIds)) {
    group.adminIds = req.body.adminIds;
  }

  if (Array.isArray(req.body.memberIds)) {
    group.memberIds = req.body.memberIds;
  }

  groups[index] = group;

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not update group'
    });
  }

  res.json(group);
});

// ----------------------------------------------------
// ADD USER TO GROUP
// ----------------------------------------------------

app.post('/api/groups/:groupId/members', (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);
  const users = readJson(USERS_FILE);

  const group = groups.find(g => g.id === groupId);
  const user = users.find(u => u.id === userId);

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

// ----------------------------------------------------
// REMOVE USER FROM GROUP
// ----------------------------------------------------

app.delete('/api/groups/:groupId/members/:userId', (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.params.userId);

  const groups = readJson(GROUPS_FILE);

  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  group.memberIds =
    group.memberIds.filter(id => id !== userId);

  group.adminIds =
    group.adminIds.filter(id => id !== userId);

  if (!writeJson(GROUPS_FILE, groups)) {
    return res.status(500).json({
      message: 'Could not remove group member'
    });
  }

  res.json(group);
});

// ----------------------------------------------------
// ASSIGN GROUP ADMIN
// ----------------------------------------------------

app.post('/api/groups/:groupId/admins', (req, res) => {

  const groupId = Number(req.params.groupId);
  const userId = Number(req.body.userId);

  const groups = readJson(GROUPS_FILE);
  const users = readJson(USERS_FILE);

  const group = groups.find(g => g.id === groupId);
  const user = users.find(u => u.id === userId);

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

// ----------------------------------------------------
// CHANNELS
// ----------------------------------------------------

app.get('/api/channels', (req, res) => {
  res.json(readJson(CHANNELS_FILE));
});

app.get('/api/channels/:channelId', (req, res) => {

  const channels = readJson(CHANNELS_FILE);

  const channel = channels.find(
    c => c.id === Number(req.params.channelId)
  );

  if (!channel) {
    return res.status(404).json({
      message: 'Channel not found'
    });
  }

  res.json(channel);
});

app.get('/api/groups/:groupId/channels', (req, res) => {

  const channels = readJson(CHANNELS_FILE);

  const groupId = Number(req.params.groupId);

  res.json(
    channels.filter(
      channel => channel.groupId === groupId
    )
  );
});

// ----------------------------------------------------
// CREATE CHANNEL
// ----------------------------------------------------

app.post('/api/channels', (req, res) => {

  const {
    groupId,
    name,
    description,
    memberIds
  } = req.body;

  const numericGroupId = Number(groupId);

  if (!numericGroupId || !name || !name.trim()) {
    return res.status(400).json({
      message: 'Group ID and channel name are required'
    });
  }

  const groups = readJson(GROUPS_FILE);
  const channels = readJson(CHANNELS_FILE);

  const group = groups.find(
    g => g.id === numericGroupId
  );

  if (!group) {
    return res.status(404).json({
      message: 'Group does not exist'
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
      message: 'That channel already exists in this group'
    });
  }

  const newChannel = {
    id: getNextId(channels),
    groupId: numericGroupId,
    name: name.trim(),
    description: description || '',
    memberIds: Array.isArray(memberIds) ? memberIds : []
  };

  channels.push(newChannel);

  if (!writeJson(CHANNELS_FILE, channels)) {
    return res.status(500).json({
      message: 'Could not save channel'
    });
  }

  res.status(201).json(newChannel);
});

// ----------------------------------------------------
// ADD USER TO CHANNEL
// ----------------------------------------------------

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

  if (!channel) {
    return res.status(404).json({
      message: 'Channel not found'
    });
  }

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  if (!channel.memberIds.includes(userId)) {
    channel.memberIds.push(userId);
  }

  if (!writeJson(CHANNELS_FILE, channels)) {
    return res.status(500).json({
      message: 'Could not update channel membership'
    });
  }

  res.json(channel);
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );

  console.log(
    `Data directory: ${DATA_DIR}`
  );
});