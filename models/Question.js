const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  answer: { type: Number, required: true },
  category: { type: String, default: 'default' },
  chapterId: { type: String, default: null } // Links question directly to a chapter
});
module.exports = mongoose.model('Question', questionSchema);

