const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    const formatted = users.map(u => ({
      id: u._id,
      _id: u._id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role || 'Admin',
      branch: u.branch || 'Headquarters',
      status: u.status || 'Active',
      phone: u.phone || '-',
      avatar: u.avatar || '',
      createdAt: u.createdAt
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { name, username, email, password, role, branch, status, phone } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'Name, Username, Email, and Password are required.' });
    }

    // Check existing user by email or username
    const existing = await User.findOne({
      $or: [
        { email: new RegExp(`^${email.trim()}$`, 'i') },
        { username: new RegExp(`^${username.trim()}$`, 'i') }
      ]
    });

    if (existing) {
      return res.status(400).json({ message: 'A user with this Email or Username already exists.' });
    }

    const user = await User.create({
      name: name.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || 'Admin',
      branch: branch || 'Headquarters',
      status: status || 'Active',
      phone: phone || ''
    });

    res.status(201).json({
      id: user._id,
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      branch: user.branch,
      status: user.status,
      phone: user.phone,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { name, username, email, password, role, branch, status, phone } = req.body;

    const updateObj = {};
    if (name) updateObj.name = name.trim();
    if (username) updateObj.username = username.trim();
    if (email) updateObj.email = email.trim().toLowerCase();
    if (password) updateObj.password = password;
    if (role) updateObj.role = role;
    if (branch) updateObj.branch = branch;
    if (status) updateObj.status = status;
    if (phone) updateObj.phone = phone;

    const user = await User.findByIdAndUpdate(req.params.id, updateObj, { new: true, select: '-password' });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      id: user._id,
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      branch: user.branch,
      status: user.status,
      phone: user.phone,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User deleted successfully.', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
