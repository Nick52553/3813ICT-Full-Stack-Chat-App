const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// ----------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// DATA FILE LOCATIONS
// ----------------------------------------------------

const DATA_DIR = path.join(
  __dirname,
  'DATA FOR THE APP PHASE 1'
);

const USERS_FILE = path.join(
  DATA_DIR,
  'user.json'
);

const GROUPS_FILE = path.join(
  DATA_DIR,
  'groups.json'
);

const CHANNELS_FILE = path.join(
  DATA_DIR,
  'channels.json'
);

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------

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
  if (!items || items.length === 0) {
    return 1;
  }

  return Math.max(
    ...items.map(item => Number(item.id) || 0)
  ) + 1;
}

// ----------------------------------------------------
// TEST / HOME ROUTE
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

  // Check that both fields were supplied
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

  // Invalid login
  if (!user) {
    return res.status(401).json({
      message: 'Invalid username or password'
    });
  }

  // Successful login
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

// Get all users
// Passwords are NOT returned.
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

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required'
    });
  }

  const users = readJson(USERS_FILE);

  // Prevent duplicate usernames
  const existingUser = users.find(
    user => user.username === username
  );

  if (existingUser) {
    return res.status(409).json({
      message: 'Username already exists'
    });
  }

  const newUser = {
    id: getNextId(users),
    username: username,
    password: password,
    age: Number(age) || 0,
    role: role || 'user'
  };

  users.push(newUser);

  const saved = writeJson(
    USERS_FILE,
    users
  );

  if (!saved) {
    return res.status(500).json({
      message: 'Could not save user'
    });
  }

  // Do not send password back
  res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    age: newUser.age,
    role: newUser.role
  });

});

/

// Get all groups
app.get('/api/groups', (req, res) => {

  const groups = readJson(GROUPS_FILE);

  res.json(groups);

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


app.post('/api/groups', (req, res) => {

  const {
    name,
    description,
    ageLimit,
    adminIds,
    memberIds
  } = req.body;

  // Basic validation
  if (!name || name.trim() === '') {
    return res.status(400).json({
      message: 'Group name is required'
    });
  }

  const groups = readJson(GROUPS_FILE);

  // Prevent duplicate group names
  const existingGroup = groups.find(
    group =>
      group.name.toLowerCase() ===
      name.trim().toLowerCase()
  );

  if (existingGroup) {
    return res.status(409).json({
      message: 'A group with that name already exists'
    });
  }

  const newGroup = {
    id: getNextId(groups),

    name: name.trim(),

    description:
      description || '',

    ageLimit:
      Number(ageLimit) || 0,

    adminIds:
      Array.isArray(adminIds)
        ? adminIds
        : [],

    memberIds:
      Array.isArray(memberIds)
        ? memberIds
        : []
  };

  groups.push(newGroup);

  const saved = writeJson(
    GROUPS_FILE,
    groups
  );

  if (!saved) {
    return res.status(500).json({
      message: 'Could not save group'
    });
  }

  res.status(201).json(newGroup);

});



app.put('/api/groups/:groupId', (req, res) => {

  const groups = readJson(GROUPS_FILE);

  const groupIndex = groups.findIndex(
    g => g.id === Number(req.params.groupId)
  );

  if (groupIndex === -1) {
    return res.status(404).json({
      message: 'Group not found'
    });
  }

  const group = groups[groupIndex];

  // Group name stays unchanged
  if (req.body.description !== undefined) {
    group.description = req.body.description;
  }

  if (req.body.ageLimit !== undefined) {
    group.ageLimit = Number(
      req.body.ageLimit
    ) || 0;
  }

  if (Array.isArray(req.body.adminIds)) {
    group.adminIds = req.body.adminIds;
  }

  if (Array.isArray(req.body.memberIds)) {
    group.memberIds = req.body.memberIds;
  }

  groups[groupIndex] = group;

  const saved = writeJson(
    GROUPS_FILE,
    groups
  );

  if (!saved) {
    return res.status(500).json({
      message: 'Could not update group'
    });
  }

  res.json(group);

});



// Get all channels
app.get('/api/channels', (req, res) => {

  const channels = readJson(CHANNELS_FILE);

  res.json(channels);

});



app.get(
  '/api/groups/:groupId/channels',
  (req, res) => {

    const channels =
      readJson(CHANNELS_FILE);

    const groupId =
      Number(req.params.groupId);

    const groupChannels =
      channels.filter(
        channel =>
          channel.groupId === groupId
      );

    res.json(groupChannels);

  }
);


app.get(
  '/api/channels/:channelId',
  (req, res) => {

    const channels =
      readJson(CHANNELS_FILE);

    const channel =
      channels.find(
        c =>
          c.id ===
          Number(req.params.channelId)
      );

    if (!channel) {
      return res.status(404).json({
        message: 'Channel not found'
      });
    }

    res.json(channel);

  }
);



app.post('/api/channels', (req, res) => {

  const {
    groupId,
    name,
    description
  } = req.body;

  // Validate required fields
  if (
    groupId === undefined ||
    !name ||
    name.trim() === ''
  ) {
    return res.status(400).json({
      message:
        'Group ID and channel name are required'
    });
  }

  const groups =
    readJson(GROUPS_FILE);

  const channels =
    readJson(CHANNELS_FILE);

  const numericGroupId =
    Number(groupId);

  // Make sure group exists
  const groupExists =
    groups.some(
      group =>
        group.id === numericGroupId
    );

  if (!groupExists) {
    return res.status(404).json({
      message: 'Group does not exist'
    });
  }

  
  const duplicateChannel =
    channels.find(
      channel =>
        channel.groupId === numericGroupId &&
        channel.name.toLowerCase() ===
          name.trim().toLowerCase()
    );

  if (duplicateChannel) {
    return res.status(409).json({
      message:
        'A channel with that name already exists in this group'
    });
  }

  const newChannel = {
    id: getNextId(channels),

    groupId:
      numericGroupId,

    name:
      name.trim(),

    description:
      description || ''
  };

  channels.push(newChannel);

  const saved =
    writeJson(
      CHANNELS_FILE,
      channels
    );

  if (!saved) {
    return res.status(500).json({
      message: 'Could not save channel'
    });
  }

  res.status(201).json(newChannel);

});


app.put(
  '/api/channels/:channelId',
  (req, res) => {

    const channels =
      readJson(CHANNELS_FILE);

    const channelIndex =
      channels.findIndex(
        c =>
          c.id ===
          Number(req.params.channelId)
      );

    if (channelIndex === -1) {
      return res.status(404).json({
        message: 'Channel not found'
      });
    }

    const channel =
      channels[channelIndex];

    if (req.body.name !== undefined) {
      channel.name =
        req.body.name.trim();
    }

    if (
      req.body.description !== undefined
    ) {
      channel.description =
        req.body.description;
    }

    channels[channelIndex] =
      channel;

    const saved =
      writeJson(
        CHANNELS_FILE,
        channels
      );

    if (!saved) {
      return res.status(500).json({
        message: 'Could not update channel'
      });
    }

    res.json(channel);

  }
);




app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

  console.log(
    `Data directory: ${DATA_DIR}`
  );

});