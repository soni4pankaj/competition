const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic.js');

// 1. Get all topics[cite: 2]
router.get('/topics', async (req, res) => {
  try {
    const topics = await Topic.find().sort({ name: 1 });
    res.json({ success: true, topics });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch topics' });
  }
});

// 2. Add new topic[cite: 2]
router.post('/topics', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Topic name is required' });

    const newTopic = new Topic({ name: name.trim() });
    await newTopic.save();
    res.json({ success: true, topic: newTopic });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Topic already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create topic' });
  }
});

// 3. Update topic by ID[cite: 2]
router.put('/topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) return res.status(400).json({ success: false, message: 'Topic name is required' });

    const updatedTopic = await Topic.findByIdAndUpdate(
      id, 
      { name: name.trim() }, 
      { new: true, runValidators: true }
    );

    if (!updatedTopic) return res.status(404).json({ success: false, message: 'Topic not found' });
    res.json({ success: true, topic: updatedTopic });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update topic' });
  }
});

// 4. Delete topic by ID[cite: 2]
router.delete('/topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTopic = await Topic.findByIdAndDelete(id);

    if (!deletedTopic) return res.status(404).json({ success: false, message: 'Topic not found' });
    res.json({ success: true, message: 'Topic deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete topic' });
  }
});

module.exports = router;