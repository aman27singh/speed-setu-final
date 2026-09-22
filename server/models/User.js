const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Super Admin', 'Admin', 'Driver'],
    default: 'Super Admin'
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  branch: {
    type: String,
    default: 'Headquarters'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  phone: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
