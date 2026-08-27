const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    // Search user by email or username (case-insensitive regex)
    const user = await User.findOne({
      $or: [
        { email: new RegExp(`^${identifier}$`, 'i') },
        { username: new RegExp(`^${identifier}$`, 'i') }
      ]
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials. Please check username/email and password.' });
    }

    const token = 'jwt_speed_setu_' + user._id + '_' + Date.now();

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/auth/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
