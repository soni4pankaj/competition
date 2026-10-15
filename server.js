const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'atlas-credentials.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
// Add these variables at the top with your other global variables
let questionTimer = null;
let answeredParticipants = new Set(); // Track who answered the current question


// Import Mongoose Models
const User = require('./models/User');
const Question = require('./models/Question');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PUBLIC_URL = process.env.PUBLIC_URL || '';
const upload = multer({ storage: multer.memoryStorage() });

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

// Delete a single question by ID
app.delete('/api/questions/:id', async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Question deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete question' });
  }
});

// Update a single question by ID
app.put('/api/questions/:id', async (req, res) => {
  try {
    const { question, options, answer, category } = req.body;
    await Question.findByIdAndUpdate(req.params.id, {
      question,
      options,
      answer: parseInt(answer),
      category
    });
    res.json({ success: true, message: 'Question updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update question' });
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

// Bulk Upload Endpoint (Supports Excel file upload)
app.post('/api/topics/:topicId/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    const { topicId } = req.params;
    let questionsData = [];

    if (req.file) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const lastQuestion = await Question.findOne().sort({ id: -1 });
      let nextId = lastQuestion ? lastQuestion.id + 1 : 1;

      questionsData = rows.map((row) => ({
        id: nextId++,
        question: row.question || row.Question,
        options: [
          row.option1 || row.Option1 || '',
          row.option2 || row.Option2 || '',
          row.option3 || row.Option3 || '',
          row.option4 || row.Option4 || ''
        ],
        answer: parseInt(row.answer !== undefined ? row.answer : row.Answer),
        category: topicId
      }));
    }

    if (questionsData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid questions found in uploaded file.' });
    }

    await Question.insertMany(questionsData);
    res.json({ success: true, message: `Successfully uploaded ${questionsData.length} questions!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to process bulk upload: ' + err.message });
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
    if (!room) return socket.emit('error_msg', 'Room not found! Please wait for host to create room.');

    socket.join(roomId);
    if (!room.players) room.players = {};
    room.players[socket.id] = { id: socket.id, name, score: 0 };

    socket.emit('joined_successfully', { roomId, name, mode: room.mode });
    io.to(roomId).emit('player_list_update', Object.values(room.players));
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

    const existingPlayers = rooms[roomId] ? rooms[roomId].players : {};

    rooms[roomId] = {
      category,
      mode, 
      questions: fetchedQuestions,
      currentQuestionIndex: 0,
      players: existingPlayers, 
      answers: {},
      status: 'waiting'
    };

    socket.emit('room_ready', { qrCode: qrImage, roomId });
  });

  socket.on('join_teacher_lobby', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error_msg', 'Room not found! Please create the room first.');

    socket.join(roomId);
    if (!room.players) room.players = {};
    room.players[socket.id] = { id: socket.id, name, score: 0 };

    io.to(roomId).emit('lobby_update', {
      players: Object.values(room.players),
      mode: room.mode,
      category: room.category
    });
  });

  socket.on('start_teacher_quiz', async (roomId) => {
    let room = rooms[roomId];
    if (!room) return;

    if (!room.questions || room.questions.length === 0) {
      room.questions = await Question.find({ category: room.category || 'default' });
      if (room.questions.length === 0) {
        room.questions = await Question.find({ category: 'default' });
      }
    }

    room.status = 'active';
    io.to(roomId).emit('quiz_started', { mode: room.mode, questions: room.questions });

    if (room.mode === 'rapid') {
      room.currentQuestionIndex = 0;
      runRapidFireQuestion(roomId);
    } else if (room.mode === 'paper') {
      const formattedQuestions = room.questions.map(q => ({
        question: q.question || q.questionText,
        options: q.options,
        answer: q.answer !== undefined ? q.answer : q.correctAnswer
      }));

      io.to(roomId).emit('display_paper_quiz', {
        questions: formattedQuestions,
		totalQuestions: room.questions.length
      });
    }
  });

  socket.on('submit_rapid_answer', ({ roomId, optionIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;

	// Prevent double-answering the same question round
    if (answeredParticipants.has(socket.id)) return;
    answeredParticipants.add(socket.id);

    const currentQ = room.questions[room.currentQuestionIndex - 1];
    if (!currentQ) return;

    const correctAnswer = currentQ.answer !== undefined ? currentQ.answer : currentQ.correctAnswer;
    const isCorrect = optionIndex === correctAnswer;

	// Calculate elapsed time in seconds from question start
    const elapsedSeconds = Math.floor((Date.now() - (room.currentQuestionStartTime || Date.now())) / 1000);

    let earnedPoints = 0;
    if (isCorrect) {
      if (elapsedSeconds <= 10) {
        earnedPoints = 15;
      } else if (elapsedSeconds <= 15) {
        earnedPoints = 10;
      } else {
        earnedPoints = 5;
      }
      room.players[socket.id].score += earnedPoints;
    } else {
      earnedPoints = -5;
      room.players[socket.id].score -= 5; // Negative marking
    }
	
	// Send individual feedback and updated score
		socket.emit('answer_feedback', { 
		  correct: isCorrect, 
		  score: room.players[socket.id].score,
		  earned: earnedPoints 
		});
    
    // Send updated scores to the teacher dashboard only (avoiding participant screen disruption)
    io.to(roomId).emit('teacher_leaderboard_update', getSortedLeaderboard(room));
	// Check if ALL connected players in the room have now answered
    const totalPlayers = Object.keys(room.players).length;
    if (totalPlayers > 0 && answeredParticipants.size >= totalPlayers) {
      if (questionTimer) clearInterval(questionTimer);
      
      // Wait for the 5-second delay before moving to the next question
      setTimeout(() => {
        runRapidFireQuestion(roomId);
      }, 5000);
    }
  });
  
  socket.on('submit_paper_answers', ({ roomId, answers }) => {
    const room = rooms[roomId];
    if (!room || !room.players[socket.id]) return;

    let score = 0;
    room.questions.forEach((q, index) => {
      const correctAnswer = q.answer !== undefined ? q.answer : q.correctAnswer;
      if (answers[index] === correctAnswer) {
        score += 10;
      }
    });

    room.players[socket.id].score = score;
    io.to(roomId).emit('lobby_update', { players: Object.values(room.players) });
    io.to(roomId).emit('teacher_leaderboard_update', getSortedLeaderboard(room));
    socket.emit('paper_submitted_success', { score, total: room.questions.length });
  });

});

function runRapidFireQuestion(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'active') return;

	// Clear tracking set for the new question round
  answeredParticipants.clear();
  
  if (room.currentQuestionIndex >= room.questions.length) {
    io.to(roomId).emit('teacher_leaderboard_update', getSortedLeaderboard(room));
    io.to(roomId).emit('quiz_ended');
    room.status = 'ended';
    return;
  }

  const q = room.questions[room.currentQuestionIndex];
  room.currentQuestionIndex++;

	room.currentQuestionStartTime = Date.now(); // Record start timestamp

	io.to(roomId).emit('next_rapid_question', {
    questionIndex: room.currentQuestionIndex,
    total: room.questions.length,
    question: q.question || q.questionText,
    options: q.options
  });

  let timeLeft = 20;
  if (questionTimer) clearInterval(questionTimer);

  questionTimer = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer_tick', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(questionTimer);
      io.to(roomId).emit('teacher_leaderboard_update', getSortedLeaderboard(room));
      setTimeout(() => {
        runRapidFireQuestion(roomId);
      }, 3000);
    }
  }, 1000);
}

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const localIP = getLocalIpAddress();
  console.log('----------------------------------------------------');
  console.log(`Server running locally at: http://localhost:${PORT}`);
  console.log(`Network Join Link: http://${localIP}:${PORT}/participant.html`);
  console.log('----------------------------------------------------');
});