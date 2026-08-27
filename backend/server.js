const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Chat application backend is running!');
});

// Login endpoint
app.post('/api/login', (req, res) => {

  const { username, password } = req.body;

  const users = JSON.parse(
  fs.readFileSync('./DATA FOR THE APP PHASE 1/user.json', 'utf8')
);

  const user = users.find(
    u => u.username === username &&
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
    role: user.role
  });

});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});