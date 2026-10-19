const express = require('express');
const router = express.Router();
const Chapter = require('../models/Chapter');

// Get all chapters
router.get('/', async (req, res) => {
    try {
        const chapters = await Chapter.find().sort({ createdAt: -1 });
        res.json({ success: true, chapters });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Add a new chapter with auto-generated unique ID
router.post('/', async (req, res) => {
    try {
        const { title, topic, content } = req.body;
        const chapterId = 'chap_' + Math.random().toString(36).substring(2, 8);
        const newChapter = new Chapter({ chapterId, title, topic, content });
        await newChapter.save();
        res.json({ success: true, message: 'Chapter added successfully!', chapter: newChapter });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update an existing chapter by ID
router.put('/:id', async (req, res) => {
    try {
        const { title, topic, content } = req.body;
        const updatedChapter = await Chapter.findByIdAndUpdate(
            req.params.id,
            { title, topic, content },
            { new: true, runValidators: true }
        );

        if (!updatedChapter) {
            return res.status(404).json({ success: false, message: 'Chapter not found' });
        }

        res.json({ success: true, message: 'Chapter updated successfully!', chapter: updatedChapter });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete a chapter
router.delete('/:id', async (req, res) => {
    try {
        const deletedChapter = await Chapter.findByIdAndDelete(req.params.id);
        if (!deletedChapter) {
            return res.status(404).json({ success: false, message: 'Chapter not found' });
        }
        res.json({ success: true, message: 'Chapter deleted successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete chapter' });
    }
});

module.exports = router;