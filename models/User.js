const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  assignedTopics: [{ type: String }] // Array of topics assigned by admin
});

module.exports = mongoose.model('User', userSchema);