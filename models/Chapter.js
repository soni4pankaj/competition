const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
  chapterId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  topic: { type: String, required: true, default: 'default' }, // Linked to topic
  content: { type: String, required: true }
});

module.exports = mongoose.model('Chapter', ChapterSchema);