const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'atlas-credentials.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');

// Import Mongoose Models
const User = require('./models/User');
const Question = require('./models/Question');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PUBLIC_URL = process.env.PUBLIC_URL || '';

// Middleware & Static Files
app.use(express.json());
app.use(express.static(__dirname));

let questionTimer = null;
let questions = [];
const rooms = {};

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas.'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- REST API ENDPOINTS ---

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Teacher dashboard
app.get('/teacher-dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/teacher.html');
});

// 1. Admin: Create a new user with assigned topics array
app.post('/api/admin/users', async (req, res) => {
  const { username, password, role, assignedTopics, assignedQuiz } = req.body;
  try {
    let topicsArray = assignedTopics;
    if (typeof assignedTopics === 'string') {
      topicsArray = assignedTopics.split(',').map(t => t.trim()).filter(Boolean);
    }
    // Backward compatibility if assignedQuiz string was sent
    if ((!topicsArray || topicsArray.length === 0) && assignedQuiz) {
      topicsArray = assignedQuiz.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (!topicsArray || topicsArray.length === 0) {
      topicsArray = ['default'];
    }

    const newUser = new User({ 
      username, 
      password, 
      role: role || 'user', 
      assignedTopics: topicsArray 
    });
    await newUser.save();
    res.json({ success: true, message: 'User created successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error: Username may already exist.' });
  }
});

// Get all users (excluding passwords)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Delete a user
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Admin: Update an existing user
app.put('/api/admin/users/:id', async (req, res) => {
  const { username, password, role, assignedTopics, assignedQuiz } = req.body;
  try {
    let topicsArray = assignedTopics;
    if (typeof assignedTopics === 'string') {
      topicsArray = assignedTopics.split(',').map(t => t.trim()).filter(Boolean);
    }
    if ((!topicsArray || topicsArray.length === 0) && assignedQuiz) {
      topicsArray = assignedQuiz.split(',').map(t => t.trim()).filter(Boolean);
    }

    const updateData = { username, role, assignedTopics: topicsArray };
    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User updated successfully!', user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// User Login Route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    res.json({ 
      success: true, 
      user: { 
        id: user._id, 
        username: user.username, 
        role: user.role, 
        assignedTopics: user.assignedTopics && user.assignedTopics.length > 0 ? user.assignedTopics : ['default'] 
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fetch Questions from MongoDB filtered by category
app.get('/api/questions', async (req, res) => {
  try {
    const category = req.query.category || 'default';
    const fetchedQuestions = await Question.find({ category: category });
    
    if (fetchedQuestions.length === 0 && category !== 'default') {
      const defaultQuestions = await Question.find({ category: 'default' });
      return res.json({ success: true, category: 'default', questions: defaultQuestions });
    }

    res.json({ success: true, category, questions: fetchedQuestions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch questions' });
  }
});

// Save Questions to MongoDB
app.post('/api/questions', async (req, res) => {
  try {
    await Question.deleteMany({});
    await Question.insertMany(req.body);
    questions = await Question.find().sort({ id: 1 });
    res.json({ success: true, message: 'Questions updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save questions' });
  }
});

async function initQuestions() {
  try {
    questions = await Question.find().sort({ id: 1 });
    if (questions.length === 0) {
      const defaultQuestions = [
        { id: 1, question: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], answer: 1, category: "default" }
      ];
      await Question.insertMany(defaultQuestions);
      questions = await Question.find().sort({ id: 1 });
    }
  } catch (err) {
    console.error('Error seeding initial questions:', err);
  }
}
initQuestions();

function getSortedLeaderboard(room) {
  return Object.values(room.players).sort((a, b) => b.score - a.score);
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Add a new question to a specific topic
app.post('/api/topics/:topicId/questions', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { question, options, answer, category } = req.body;
    
    // Find highest existing id to increment
    const lastQuestion = await Question.findOne().sort({ id: -1 });
    const newId = lastQuestion ? lastQuestion.id + 1 : 1;

    const newQuestion = new Question({
      id: newId,
      question: question,
      options: options, // Array of 4 strings
      answer: parseInt(answer), // Index 0-3
      category: topicId || category || 'default'
    });
    
    await newQuestion.save();
    res.json({ success: true, message: 'Question added successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Middleware & Static Files
app.use(express.json());
app.use(express.static(__dirname));

// --- Topic-Specific Question Routes ---

// Get all questions for a specific topic
app.get('/api/topics/:topicId/questions', async (req, res) => {
  try {
    const { topicId } = req.params;
    const questions = await Question.find({ category: topicId });
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add a new question to a specific topic
app.post('/api/topics/:topicId/questions', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { question, options, answer, category } = req.body;
    
    const lastQuestion = await Question.findOne().sort({ id: -1 });
    const newId = lastQuestion ? lastQuestion.id + 1 : 1;

    const newQuestion = new Question({
      id: newId,
      question: question,
      options: options,
      answer: parseInt(answer),
      category: topicId || category || 'default'
    });
    
    await newQuestion.save();
    res.json({ success: true, message: 'Question added successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SOCKET.IO REAL-TIME GAME LOGIC
io.on('connection', (socket) => {
  
  socket.on('create_room', async (data) => {
    const roomId = typeof data === 'object' ? data.roomId : data;
    const mode = typeof data === 'object' ? data.mode : 'manual';

    questions = await Question.find().sort({ id: 1 });
    socket.join(roomId);

    const reqHost = socket.handshake.headers.host;
    let baseUrl;

    if (process.env.PUBLIC_URL) {
      baseUrl = process.env.PUBLIC_URL;
    } else if (reqHost && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1')) {
      const protocol = socket.handshake.headers['x-forwarded-proto'] || 'https';
      baseUrl = `${protocol}://${reqHost}`;
    } else {
      const localIP = getLocalIpAddress();
      baseUrl = `http://${localIP}:${PORT}`;
    }

    const joinUrl = `${baseUrl}/participant.html?room=${roomId}`;
    const qrImage = await QRCode.toDataURL(joinUrl);

    rooms[roomId] = {
      currentQuestion: 0,
      players: {},
      answers: {},
      mode: mode
    };

    socket.emit('room_created', { roomId, qrCode: qrImage });
  });

  socket.on('join_room', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error_msg', 'Room not found!');

    socket.join(roomId);
    room.players[socket.id] = { id: socket.id, name, score: 0 };

    socket.emit('joined_successfully', { roomId, name, mode: room.mode });
    io.to(roomId).emit('player_list_update', Object.values(room.players));
  });

  function loadQuestion(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    if (questionTimer) clearInterval(questionTimer);

    if (room.currentQuestion >= questions.length) {
      const finalLeaderboard = getSortedLeaderboard(room);
      io.to(roomId).emit('quiz_ended', finalLeaderboard);
      return;
    }

    const q = questions[room.currentQuestion];
    room.answers = {};
    room.questionStartTime = Date.now();

    io.to(roomId).emit('display_question', {
      questionNumber: room.currentQuestion + 1,
      question: q.question,
      options: q.options
    });

    room.currentQuestion += 1;

    let timeLeft = 15;
    io.to(roomId).emit('timer_tick', timeLeft);

    questionTimer = setInterval(() => {
      timeLeft -= 1;
      io.to(roomId).emit('timer_tick', timeLeft);

      if (timeLeft <= 0) {
        clearInterval(questionTimer);
        const leaderboard = getSortedLeaderboard(room);
        io.to(roomId).emit('time_up');
        io.to(roomId).emit('leaderboard_data', leaderboard);

        if (room.mode === 'auto') {
          setTimeout(() => {
            loadQuestion(roomId);
          }, 5000);
        }
      }
    }, 1000);
  }

  socket.on('next_question', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    socket.join(roomId);
    loadQuestion(roomId);
  });

  socket.on('submit_answer', ({ roomId, selectedOption }) => {
    const room = rooms[roomId];
    if (!room || room.answers[socket.id] !== undefined) return;

    const startTime = room.questionStartTime || Date.now();
    const timeTaken = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

    room.answers[socket.id] = selectedOption;

    const currentQ = questions[room.currentQuestion - 1];
    let scoreGained = 0;
    let isCorrect = false;

    if (currentQ && selectedOption === currentQ.answer) {
      isCorrect = true;
      scoreGained = timeTaken <= 5 ? 15 : (timeTaken <= 10 ? 10 : 5);
      room.players[socket.id].score += scoreGained;
    } else {
      scoreGained = -5;
      isCorrect = false;
      room.players[socket.id].score += scoreGained;
    }

    socket.emit('answer_confirmed', { timeTaken, scoreGained, isCorrect });

    const totalPlayers = Object.keys(room.players).length;
    const answeredPlayers = Object.keys(room.answers).length;

    if (answeredPlayers >= totalPlayers && totalPlayers > 0) {
      if (questionTimer) clearInterval(questionTimer);

      const leaderboard = getSortedLeaderboard(room);
      io.to(roomId).emit('time_up');
      io.to(roomId).emit('leaderboard_data', leaderboard);

      if (room.mode === 'auto') {
        setTimeout(() => {
          loadQuestion(roomId);
        }, 5000);
      }
    }
  });

  socket.on('show_leaderboard', (roomId) => {
    if (questionTimer) clearInterval(questionTimer);
    const room = rooms[roomId];
    if (!room) return;

    const leaderboard = getSortedLeaderboard(room);
    io.to(roomId).emit('leaderboard_data', leaderboard);
    socket.emit('leaderboard_data', leaderboard);
    room.currentQuestion += 1;
  });

  // --- TEACHER & RAPID-FIRE / PAPER MODE SOCKET HANDLERS ---
  socket.on('create_teacher_room', async ({ roomId, category, mode }) => {
    socket.join(roomId);

    let fetchedQuestions = await Question.find({ category });
    if (fetchedQuestions.length === 0) {
      fetchedQuestions = await Question.find({ category: 'default' });
    }

    const reqHost = socket.handshake.headers.host;
    let baseUrl = process.env.PUBLIC_URL || `http://${getLocalIpAddress()}:${PORT}`;
    const joinUrl = `${baseUrl}/participant.html?room=${roomId}&category=${category}&mode=${mode}`;
    const qrImage = await QRCode.toDataURL(joinUrl);

    rooms[roomId] = {
      category,
      mode, 
      questions: fetchedQuestions,
      currentQuestionIndex: 0,
      players: rooms[roomId] ? rooms[roomId].players : {}, 
      answers: {},
      status: 'waiting'
    };

    Object.keys(rooms[roomId].players).forEach(id => {
      rooms[roomId].players[id].score = 0;
    });

    socket.emit('room_ready', { qrCode: qrImage, roomId });
  });

  socket.on('join_teacher_lobby', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error_msg', 'Room not found!');

    socket.join(roomId);
    room.players[socket.id] = { id: socket.id, name, score: 0 };

    io.to(roomId).emit('lobby_update', {
      players: Object.values(room.players),
      mode: room.mode,
      category: room.category
    });
  });

  socket.on('start_teacher_quiz', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.status = 'active';
    io.to(roomId).emit('quiz_started', { mode: room.mode, questions: room.questions });

    if (room.mode === 'rapid') {
      runRapidFireQuestion(roomId);
    } else if (room.mode === 'paper') {
      io.to(roomId).emit('display_paper_quiz', {
        questions: room.questions
      });
    }
  });
 
  socket.on('submit_paper_answers', ({ roomId, answers }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;

    let score = 0;
    room.questions.forEach((q, index) => {
      if (answers[index] === q.answer) {
        score += 10;
      }
    });

    room.players[socket.id].score = score;
    io.to(roomId).emit('lobby_update', { players: Object.values(room.players) });
    socket.emit('paper_submitted_success', { score, total: room.questions.length });
  });
 
  function runRapidFireQuestion(roomId) {
    const room = rooms[roomId];
    if (!room || room.currentQuestionIndex >= room.questions.length) {
      const leaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);
      io.to(roomId).emit('quiz_ended', leaderboard);
      return;
    }

    const q = room.questions[room.currentQuestionIndex];
    room.answers = {};

    io.to(roomId).emit('next_rapid_question', {
      questionIndex: room.currentQuestionIndex + 1,
      total: room.questions.length,
      question: q.question,
      options: q.options
    });

    let timeLeft = 20;
    const rapidTimer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('timer_tick', timeLeft);

      const allAnswered = Object.keys(room.answers).length >= Object.keys(room.players).length;
      if (timeLeft <= 0 || allAnswered) {
        clearInterval(rapidTimer);

        io.to(roomId).emit('question_break', { correctIndex: q.answer });
        room.currentQuestionIndex++;

        setTimeout(() => {
          runRapidFireQuestion(roomId);
        }, 5000);
      }
    }, 1000);
  }

  socket.on('submit_rapid_answer', ({ roomId, optionIndex }) => {
    const room = rooms[roomId];
    if (!room || room.answers[socket.id] !== undefined) return;

    room.answers[socket.id] = optionIndex;
    const currentQ = room.questions[room.currentQuestionIndex];

    if (optionIndex === currentQ.answer) {
      room.players[socket.id].score += 10;
      socket.emit('answer_feedback', { correct: true });
    } else {
      socket.emit('answer_feedback', { correct: false });
    }

    io.to(roomId).emit('lobby_update', { players: Object.values(room.players) });
  });

});

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const localIP = getLocalIpAddress();
  console.log('----------------------------------------------------');
  console.log(`Server running locally at: http://localhost:${PORT}`);
  console.log(`Network Join Link: http://${localIP}:${PORT}/participant.html`);
  console.log('----------------------------------------------------');
});