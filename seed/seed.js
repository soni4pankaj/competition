const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, 'atlas-credentials.env') });

if (dotenvResult.error) {
  console.log("Dotenv error:", dotenvResult.error);
}

console.log("Current Working Directory:", process.cwd());
console.log("MONGODB_URI from env:", process.env.MONGODB_URI ? "Found!" : "Undefined");

const mongoose = require('mongoose');
const User = require('./models/User');
const Question = require('./models/Question');

async function seedDB() {
  if (!process.env.MONGODB_URI) {
    console.error("ERROR: MONGODB_URI is not defined in your .env file!");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas.');

    // Clear and seed Users with assignedTopics array
    await User.deleteMany({});
    await User.insertMany([
      { username: 'admin', password: 'admin123', role: 'admin', assignedTopics: ['default'] },
      { username: 'teacher1', password: 'teacher123', role: 'teacher', assignedTopics: ['finance', 'javascript'] },
      { username: 'user1', password: 'user123', role: 'user', assignedTopics: ['finance'] }
    ]);

    // Clear and seed Questions with categories and IDs
    await Question.deleteMany({});
    await Question.insertMany([
      { 
        id: 1, 
        question: "What does RBI stand for?", 
        options: ["Reserve Bank of India", "Rate Bank of India", "Regional Bank India", "Rural Banking Institution"], 
        answer: 0, 
        category: "finance" 
      },
      { 
        id: 2, 
        question: "What is the primary focus of Basel III norms?", 
        options: ["Software testing standards", "Bank capital adequacy, stress testing, and market liquidity risk", "Cloud computing security", "International trade tariffs"], 
        answer: 1, 
        category: "finance" 
      },
      { 
        id: 3, 
        question: "What does NPA stand for in commercial banking?", 
        options: ["Net Payment Association", "Non-Performing Asset", "National Pension Account", "New Provisional Asset"], 
        answer: 1, 
        category: "finance" 
      },
      { 
        id: 4, 
        question: "Which ratio measures a bank's liquid assets against its short-term obligations under Basel III?", 
        options: ["Capital Adequacy Ratio (CAR)", "Liquidity Coverage Ratio (LCR)", "Credit Deposit Ratio", "Return on Equity (ROE)"], 
        answer: 1, 
        category: "finance" 
      },
      { 
        id: 5, 
        question: "Which keyword declares a constant in JavaScript?", 
        options: ["var", "let", "const"], 
        answer: 2, 
        category: "javascript" 
      },
      { 
        id: 6, 
        question: "General Node.js question?", 
        options: ["A", "B", "C"], 
        answer: 0, 
        category: "default" 
      }
    ]);

    console.log('Database seeded with default users and categorized finance questions successfully!');
  } catch (err) {
    console.error('Database seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

seedDB();