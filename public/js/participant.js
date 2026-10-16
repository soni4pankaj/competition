// --- Participant Quiz & Timer Script ---

document.addEventListener('DOMContentLoaded', () => {
  window.loadedQuestions = [];
  window.timerInterval = null;

  // Audio Elements
  const bgMusic = document.getElementById('bg-music');
  const correctSfx = document.getElementById('correct-sfx');
  const wrongSfx = document.getElementById('wrong-sfx');

  // DOM Elements
  const joinBox = document.getElementById('join-box');
  const waitingBox = document.getElementById('waiting-box');
  const questionBox = document.getElementById('question-box');
  const scoreboardBox = document.getElementById('scoreboard-box');

  const roomInput = document.getElementById('room-input');
  const nameInput = document.getElementById('name-input');
  const joinBtn = document.getElementById('join-btn');
  const errorMsg = document.getElementById('error-msg');
  const playerDisplayName = document.getElementById('player-display-name');

  const questionText = document.getElementById('question-text');
  const timerContainer = document.getElementById('timer-container');
  const timerDisplay = document.getElementById('timer-display');
  const optionsContainer = document.getElementById('options-container');
  const answerStatus = document.getElementById('answer-status');
  const scoreList = document.getElementById('score-list');

  const paperTimerContainer = document.getElementById('paper-timer-container');
  const paperTimerDisplay = document.getElementById('paper-timer-display');

  let currentRoomId = '';
  let selectedBtnRef = null;
  let roomGameMode = 'manual';
  let paperInterval = null;

  // Helper: Play SFX and duck background music volume
  function playSoundEffect(audioElement) {
    if (!audioElement) return;

    if (bgMusic && !bgMusic.paused) {
      bgMusic.volume = 0.2;
    }

    audioElement.currentTime = 0;
    audioElement.play().catch(err => console.log('SFX Play error:', err));

    audioElement.onended = () => {
      if (bgMusic) bgMusic.volume = 1.0;
    };
  }

  // Automatically grab Room ID and Mode from URL query parameters (QR code)
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  const modeParam = urlParams.get('mode');
  if (roomParam) {
    roomInput.value = roomParam;
  }
  if (modeParam) {
    roomGameMode = modeParam;
  }

  // 1. Join Room / Register Button Action
  joinBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    const name = nameInput.value.trim();

    if (!roomId) {
      errorMsg.textContent = 'Invalid room link. Please re-scan the QR code!';
      return;
    }

    if (!name) {
      errorMsg.textContent = 'Please enter your name!';
      return;
    }

    if (bgMusic) {
      bgMusic.volume = 1.0;
      bgMusic.play().catch(err => console.log('Autoplay prevented:', err));
    }

    currentRoomId = roomId;

    socket.emit('join_room', { roomId, name });
    socket.emit('join_teacher_lobby', { roomId, name });

    playerDisplayName.textContent = name;
    joinBox.classList.add('hidden');
    waitingBox.classList.remove('hidden');
  });

  // 2. Successful Join Listeners
  socket.on('lobby_update', () => {
    waitingBox.classList.remove('hidden');
  });

  socket.on('joined_successfully', ({ roomId, name, mode }) => {
    playerDisplayName.textContent = name;
    joinBox.classList.add('hidden');
    waitingBox.classList.remove('hidden');

    if (mode) {
      roomGameMode = mode;
    }
  });

  socket.on('error_msg', (msg) => {
    errorMsg.textContent = msg;
  });

  // 3. Question Display Listeners
  socket.on('display_question', (data) => {
    if (paperInterval) clearInterval(paperInterval);
    if (paperTimerContainer) paperTimerContainer.classList.add('hidden');
    
    waitingBox.classList.add('hidden');
    scoreboardBox.classList.add('hidden');
    questionBox.classList.remove('hidden');

    if (timerContainer) {
      timerContainer.style.display = 'block';
    }

    answerStatus.textContent = '';
    questionText.textContent = `Q${data.questionNumber}: ${data.question}`;
    
    optionsContainer.innerHTML = '';
    data.options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => submitAnswer(index, btn));
      optionsContainer.appendChild(btn);
    });
  });

  socket.on('next_rapid_question', (data) => {
    if (paperInterval) clearInterval(paperInterval);
    if (paperTimerContainer) paperTimerContainer.classList.add('hidden');

    waitingBox.classList.add('hidden');
    scoreboardBox.classList.add('hidden');
    questionBox.classList.remove('hidden');

    if (timerContainer) {
      timerContainer.style.display = 'block';
    }

    answerStatus.textContent = '';
    questionText.textContent = `Q${data.questionIndex}/${data.total}: ${data.question}`;
    
    optionsContainer.innerHTML = '';
    data.options.forEach((opt, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => submitRapidAnswer(index, btn));
      optionsContainer.appendChild(btn);
    });
  });

  function submitAnswer(selectedIndex, clickedBtn) {
    selectedBtnRef = clickedBtn;
    const buttons = optionsContainer.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    clickedBtn.style.backgroundColor = '#ffc107';
    clickedBtn.style.color = '#000';

    socket.emit('submit_answer', {
      roomId: currentRoomId,
      selectedOption: selectedIndex
    });
  }

  function submitRapidAnswer(selectedIndex, clickedBtn) {
    selectedBtnRef = clickedBtn;
    const buttons = optionsContainer.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    clickedBtn.style.backgroundColor = '#ffc107';
    clickedBtn.style.color = '#000';

    socket.emit('submit_rapid_answer', {
      roomId: currentRoomId,
      optionIndex: selectedIndex
    });
  }

  // Paper Style Mode Listener with Active Countdown Timer
  socket.on('display_paper_quiz', ({ questions }) => {
    waitingBox.classList.add('hidden');
    scoreboardBox.classList.add('hidden');
    questionBox.classList.remove('hidden');

    if (timerContainer) {
      timerContainer.style.display = 'none'; // Hide rapid timer
    }

    if (paperTimerContainer) {
      paperTimerContainer.classList.remove('hidden');
      paperTimerContainer.style.display = 'block';
    }

    let paperTimeLeft = Math.max(questions.length * 30, 120);

    if (paperInterval) clearInterval(paperInterval);
    paperInterval = setInterval(() => {
      let mins = Math.floor(paperTimeLeft / 60);
      let secs = paperTimeLeft % 60;
      if (paperTimerDisplay) {
        paperTimerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      if (paperTimeLeft <= 0) {
        clearInterval(paperInterval);
        alert('Time is up! Automatically submitting your paper.');
        window.submitPaperAnswers();
      }
      paperTimeLeft--;
    }, 1000);

    questionText.innerHTML = `<h3 style="color: #007bff; text-align: center; margin-bottom: 5px;">📝 Paper Style Exam</h3>`;
    
    let htmlContent = '';
    questions.forEach((q, qIndex) => {
      let optionsHtml = q.options.map((opt, optIdx) => `
        <label style="display: block; margin: 8px 0; cursor: pointer; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #ccc;">
          <input type="radio" name="paper-q-${qIndex}" value="${optIdx}" style="margin-right: 8px;"> ${opt}
        </label>
      `).join('');

      htmlContent += `
        <div style="background: #f9f9f9; padding: 15px; margin-bottom: 15px; border-radius: 6px; border: 1px solid #ddd;">
          <p><strong>Q${qIndex + 1}: ${q.question}</strong></p>
          ${optionsHtml}
        </div>
      `;
    });

    htmlContent += `<button type="button" onclick="submitPaperAnswers()" style="background: #28a745; color: white; padding: 12px; width: 100%; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 10px;">Submit Paper</button>`;
    optionsContainer.innerHTML = htmlContent;

    window.submitPaperAnswers = function() {
      if (paperInterval) clearInterval(paperInterval);
      if (paperTimerContainer) paperTimerContainer.classList.add('hidden');
      
      const userAnswers = {};
      let answeredCount = 0;

      questions.forEach((_, qIndex) => {
        const selected = document.querySelector(`input[name="paper-q-${qIndex}"]:checked`);
        if (selected) {
          userAnswers[qIndex] = parseInt(selected.value);
          answeredCount++;
        } else {
          userAnswers[qIndex] = null;
        }
      });

      if (answeredCount === 0 && !confirm('You have not answered any questions. Do you still want to submit?')) {
        return;
      }

      socket.emit('submit_paper_answers', { roomId: currentRoomId, answers: userAnswers });
    };
  });

  socket.on('paper_submitted_success', ({ score, total }) => {
    if (paperInterval) clearInterval(paperInterval);
    if (paperTimerContainer) paperTimerContainer.classList.add('hidden');

    questionBox.classList.add('hidden');
    scoreboardBox.classList.remove('hidden');
    
    const manualNotice = document.getElementById('manual-wait-notice');
    if (manualNotice) manualNotice.classList.add('hidden');

    const myScoreEl = document.getElementById('my-score');
    if (myScoreEl) myScoreEl.textContent = score;

    answerStatus.textContent = `Quiz Completed! You scored ${score} out of ${total * 10} points.`;
    
    const scoreboardTitle = document.getElementById('scoreboard-title');
    if (scoreboardTitle) scoreboardTitle.textContent = "🎉 Paper Exam Finished! 🎉";
  });

  // 4. Answer Confirmation & Audio SFX Feedbacks
  socket.on('answer_confirmed', ({ isCorrect } = {}) => {
    if (isCorrect === true) {
      answerStatus.textContent = 'Correct Answer! 🎉';
      playSoundEffect(correctSfx);
      if (selectedBtnRef) {
        selectedBtnRef.style.backgroundColor = '#28a745';
        selectedBtnRef.style.color = '#fff';
      }
    } else if (isCorrect === false) {
      answerStatus.textContent = 'Incorrect Answer! ❌';
      playSoundEffect(wrongSfx);
      if (selectedBtnRef) {
        selectedBtnRef.style.backgroundColor = '#dc3545';
        selectedBtnRef.style.color = '#fff';
      }
    }
  });

	socket.on('answer_feedback', ({ correct, score }) => {
		if (correct) {
		  answerStatus.textContent = 'Correct Answer! 🎉 (+15 pts)';
		  playSoundEffect(correctSfx);
		  if (selectedBtnRef) {
			selectedBtnRef.style.backgroundColor = '#28a745';
			selectedBtnRef.style.color = '#fff';
		  }
		} else {
		  answerStatus.textContent = 'Incorrect Answer! ❌';
		  playSoundEffect(wrongSfx);
		  if (selectedBtnRef) {
			selectedBtnRef.style.backgroundColor = '#dc3545';
			selectedBtnRef.style.color = '#fff';
		  }
		}

		// Update both the live question view score and scoreboard view score
		const liveScoreEl = document.getElementById('live-my-score');
		if (liveScoreEl && score !== undefined) {
		  liveScoreEl.textContent = score;
		}

		const myScoreEl = document.getElementById('my-score');
		if (myScoreEl && score !== undefined) {
		  myScoreEl.textContent = score;
		}
	  });
  

	socket.on('timer_tick', (timeLeft) => {
		if (!paperInterval) {
		  timerDisplay.textContent = timeLeft;
		  
		  // If time runs out, disable options immediately
		  if (timeLeft <= 0) {
			disableAllOptions();
			answerStatus.textContent = "Time's up! Waiting for next question...";
		  }
		}
	  });
  

  socket.on('quiz_ended', () => {
    if (paperInterval) clearInterval(paperInterval);
    if (paperTimerContainer) paperTimerContainer.classList.add('hidden');

    if (bgMusic) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
});

// Helper to disable options when time expires
  function disableAllOptions() {
    const buttons = optionsContainer.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
    });
  }
  
socket.on('participant_final_results', (leaderboard) => {
    if (paperInterval) clearInterval(paperInterval);
    if (paperTimerContainer) paperTimerContainer.classList.add('hidden');

    questionBox.classList.add('hidden');
    waitingBox.classList.add('hidden');
    scoreboardBox.classList.remove('hidden');

    const manualNotice = document.getElementById('manual-wait-notice');
    if (manualNotice) manualNotice.classList.add('hidden');

    // Find current participant's rank and stats
    const myIndex = leaderboard.findIndex(p => p.id === socket.id);
    const me = leaderboard[myIndex] || { score: 0, totalTime: 0 };

    const myScoreEl = document.getElementById('my-score');
    if (myScoreEl) myScoreEl.textContent = me.score;

    const scoreboardTitle = document.getElementById('scoreboard-title');
    if (scoreboardTitle) scoreboardTitle.textContent = `🎉 Quiz Completed! You finished at Rank #${myIndex + 1} 🎉`;

    // Render full winner ranking list for participants
    scoreList.innerHTML = leaderboard.map((p, index) => {
      const isMe = p.id === socket.id;
      let rankIcon = `#${index + 1}`;
      if (index === 0) rankIcon = '🥇';
      if (index === 1) rankIcon = '🥈';
      if (index === 2) rankIcon = '🥉';

      return `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; margin: 6px 0; border-radius: 6px; ${isMe ? 'font-weight: bold; background: #d1ecf1; border: 1px solid #bee5eb;' : 'background: #e9ecef;'}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span><strong>${rankIcon}</strong></span>
            <span>${p.name} ${isMe ? '(You)' : ''}</span>
          </div>
          <div style="text-align: right;">
            <strong>${p.score}</strong> pts <br><small style="color: #666;">(${p.totalTime || 0}s)</small>
          </div>
        </li>
      `;
    }).join('');
  });