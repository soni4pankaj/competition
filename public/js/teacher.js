// --- Teacher Dashboard & Socket Room Management Script ---

// Global Teacher Dashboard Initialization (Defined at top-level to prevent timing issues)
window.initTeacherDashboard = function(user) {
  const topics = user && user.assignedTopics && user.assignedTopics.length > 0 ? user.assignedTopics : ['default'];

  // 1. Populate Quiz Room Topic Select
  const topicSelect = document.getElementById('teacher-topic-select');
  if (topicSelect) {
    topicSelect.innerHTML = '';
    topics.forEach(topic => {
      topicSelect.innerHTML += `<option value="${topic}">${topic}</option>`;
    });
  }

  // 2. Populate Question Manager Topic Select
  const manageTopicSelect = document.getElementById('teacher-manage-topic-select');
  if (manageTopicSelect) {
    manageTopicSelect.innerHTML = '';
    topics.forEach(topic => {
      manageTopicSelect.innerHTML += `<option value="${topic}">${topic}</option>`;
    });
  }

  const createRoomBtn = document.getElementById('create-room-btn');
  if (createRoomBtn) {
    const newBtn = createRoomBtn.cloneNode(true);
    createRoomBtn.parentNode.replaceChild(newBtn, createRoomBtn);

    newBtn.addEventListener('click', () => {
      const selectedTopic = topicSelect ? topicSelect.value : 'default';
      const selectedMode = document.getElementById('teacher-mode-select').value;
      window.currentRoomId = 'room_' + Math.random().toString(36).substring(2, 8);

      document.getElementById('teacher-lobby-card').classList.remove('hidden');
      document.getElementById('qr-code-section').classList.remove('hidden');
      document.getElementById('start-quiz-session-btn').classList.remove('hidden');
      document.getElementById('lobby-qr-img').src = '';
      document.getElementById('lobby-student-count').textContent = '0';
      document.getElementById('lobby-student-list').innerHTML = '';

      if (typeof socket === 'undefined') {
        window.socket = io();
      }

      socket.emit('create_teacher_room', { 
        roomId: window.currentRoomId, 
        category: selectedTopic, 
        mode: selectedMode 
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Load Chapters on startup
  loadChapters();

  // Question Manager Controls Binding
  const showQuestionsBtn = document.getElementById('teacher-show-questions-btn');
  if (showQuestionsBtn) {
    showQuestionsBtn.onclick = async () => {
      const manageTopicSelect = document.getElementById('teacher-manage-topic-select');
      const topic = manageTopicSelect ? manageTopicSelect.value : 'default';
      loadQuestionsForTopic(topic);
    };
  }

  const openAddBtn = document.getElementById('teacher-open-add-modal-btn');
  if (openAddBtn) {
    openAddBtn.onclick = () => {
      openQuestionModal();
    };
  }

  // Inject Bulk Upload UI cleanly if not already present in the DOM
  const headings = Array.from(document.querySelectorAll('h2'));
  const managerHeading = headings.find(h => h.textContent.includes('Topic Question Bank Manager'));
  const questionManagerCard = managerHeading ? managerHeading.closest('.bg-slate-900\\/40') : null;

  if (questionManagerCard && !document.getElementById('bulk-upload-container')) {
    const bulkDiv = document.createElement('div');
    bulkDiv.id = 'bulk-upload-container';
    bulkDiv.className = 'p-4 rounded-2xl bg-slate-950/40 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 mt-4';
    bulkDiv.innerHTML = `
      <div>
        <h3 class="text-xs font-semibold text-white flex items-center gap-1.5">
          <span>📁 Bulk Upload Questions (Excel .xlsx)</span>
        </h3>
        <p class="text-[10px] text-slate-400 mt-0.5">Columns required: <code class="text-purple-300">question, option1, option2, option3, option4, answer (0-3)</code></p>
      </div>
      <div class="flex items-center gap-2 w-full md:w-auto">
        <input type="file" id="bulk-file-input" accept=".xlsx, .xls" class="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer" />
        <button id="upload-bulk-btn" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all">
          Upload Excel
        </button>
      </div>
    `;
    
    const tableWrapper = questionManagerCard.querySelector('.rounded-2xl.border');
    if (tableWrapper) {
      questionManagerCard.insertBefore(bulkDiv, tableWrapper);
    } else {
      questionManagerCard.appendChild(bulkDiv);
    }

    document.getElementById('upload-bulk-btn').addEventListener('click', async () => {
      const fileInput = document.getElementById('bulk-file-input');
      const manageTopicSelect = document.getElementById('teacher-manage-topic-select');
      const topic = manageTopicSelect ? manageTopicSelect.value : 'default';

      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select an Excel (.xlsx) file first!');
        return;
      }

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      try {
        const res = await fetch(`/api/topics/${encodeURIComponent(topic)}/bulk-upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          alert(data.message);
          fileInput.value = '';
          loadQuestionsForTopic(topic);
        } else {
          alert(data.message || 'Upload failed');
        }
      } catch (err) {
        alert('Error uploading file.');
      }
    });
  }

  // Socket listeners for teacher room & lobby updates
  setTimeout(() => {
    if (typeof socket !== 'undefined') {
      socket.on('room_ready', ({ qrCode, roomId }) => {
        const qrImg = document.getElementById('lobby-qr-img');
        const lobbyCard = document.getElementById('teacher-lobby-card');
        if (qrImg) qrImg.src = qrCode;
        if (lobbyCard) lobbyCard.classList.remove('hidden');
      });

      window.latestLeaderboard = [];

      socket.on('lobby_update', ({ players }) => {
        const countEl = document.getElementById('lobby-student-count');
        if (countEl) countEl.textContent = players.length;
        
        const list = document.getElementById('lobby-student-list');
        if (list) {
          list.innerHTML = '';
          const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
          sortedPlayers.forEach((p, index) => {
            let rankIcon = `#${index + 1}`;
            if (index === 0) rankIcon = '🥇';
            if (index === 1) rankIcon = '🥈';
            if (index === 2) rankIcon = '🥉';

            list.innerHTML += `
              <li class="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm">${rankIcon}</span>
                  <span class="font-semibold">#${index + 1} ${p.name}</span>
                </div>
                <span class="font-bold text-white">${p.score} pts</span>
              </li>
            `;
          });
        }
      });

      socket.on('teacher_leaderboard_update', (leaderboard) => {
        window.latestLeaderboard = leaderboard;
        const countEl = document.getElementById('lobby-student-count');
        if (countEl) countEl.textContent = leaderboard.length;
        
        const list = document.getElementById('lobby-student-list');
        if (list) {
          list.innerHTML = '';
          const sortedPlayers = [...leaderboard].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.totalTime || 0) - (b.totalTime || 0);
          });
          
          sortedPlayers.forEach((p, index) => {
            let rankIcon = `#${index + 1}`;
            if (index === 0) rankIcon = '🥇';
            if (index === 1) rankIcon = '🥈';
            if (index === 2) rankIcon = '🥉';

            list.innerHTML += `
              <li class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 mb-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm">${rankIcon}</span>
                  <span class="font-semibold text-white">${p.name}</span>
                </div>
                <div class="text-right">
                  <span class="font-bold text-emerald-400">${p.score} pts</span>
                  <span class="text-[11px] text-slate-400 block">(${p.totalTime || 0}s)</span>
                </div>
              </li>
            `;
          });
        }
      });
	  
      socket.on('quiz_ended', () => {
        if (window.latestLeaderboard && window.latestLeaderboard.length > 0) {
          showTeacherPodiumModal(window.latestLeaderboard);
        }
      });
    }
  }, 500);

  const startQuizSessionBtn = document.getElementById('start-quiz-session-btn');
  if (startQuizSessionBtn) {
    startQuizSessionBtn.addEventListener('click', () => {
      if (window.currentRoomId && typeof socket !== 'undefined') {
        socket.emit('start_teacher_quiz', window.currentRoomId);
        
        const qrSection = document.getElementById('qr-code-section');
        if (qrSection) qrSection.classList.add('hidden');

        const startBtn = document.getElementById('start-quiz-session-btn');
        if (startBtn) startBtn.classList.add('hidden');
      }
    });
  }

  // Handle Question Form Submit (Add or Update)
  const questionForm = document.getElementById('questionForm');
  if (questionForm) {
    questionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-question-id').value;
      const manageTopicSelect = document.getElementById('teacher-manage-topic-select');
      const topic = manageTopicSelect ? manageTopicSelect.value : 'default';
      const questionText = document.getElementById('modal-question-text').value;
      const options = [
        document.getElementById('modal-option-0').value,
        document.getElementById('modal-option-1').value,
        document.getElementById('modal-option-2').value,
        document.getElementById('modal-option-3').value
      ];
      const answer = parseInt(document.getElementById('modal-correct-answer').value);

      const payload = { question: questionText, options, answer, category: topic };

      try {
        const url = id ? `/api/questions/${id}` : `/api/topics/${encodeURIComponent(topic)}/questions`;
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          closeQuestionModal();
          loadQuestionsForTopic(topic);
        } else {
          alert(data.message || 'Operation failed');
        }
      } catch (err) {
        alert('Error saving question');
      }
    });
  }
});

async function loadQuestionsForTopic(topic) {
  const tbody = document.getElementById('teacher-questions-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-slate-400">Loading questions...</td></tr>`;

  try {
    const res = await fetch(`/api/topics/${encodeURIComponent(topic)}/questions`);
    const data = await res.json();

    if (data.success && data.questions.length > 0) {
      tbody.innerHTML = '';
      data.questions.forEach((q) => {
        const optionsHtml = q.options.map((opt, idx) => `<span class="${idx === (q.answer !== undefined ? q.answer : q.correctAnswer) ? 'text-emerald-400 font-bold' : 'text-slate-300'}">${idx + 1}. ${opt}</span>`).join('<br>');
        tbody.innerHTML += `
          <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
            <td class="px-4 py-3 text-xs text-slate-200 font-medium max-w-xs">${q.question || q.questionText}</td>
            <td class="px-4 py-3 text-xs">${optionsHtml}</td>
            <td class="px-4 py-3 text-xs text-emerald-300 font-semibold">Option ${(q.answer !== undefined ? q.answer : q.correctAnswer) + 1}</td>
            <td class="px-4 py-3 text-xs text-right space-x-2">
              <button onclick='editQuestion(${JSON.stringify(q)})' class="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-300 hover:bg-blue-500/20">Edit</button>
              <button onclick='deleteQuestion("${q._id || q.id}")' class="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20">Delete</button>
            </td>
          </tr>
        `;
      });
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
      tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-slate-500">No questions found for this topic. Click "Add Question" to create one.</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-xs text-rose-400">Failed to load questions.</td></tr>`;
  }
}

function openQuestionModal(question = null) {
  const modal = document.getElementById('questionModal');
  const title = document.getElementById('question-modal-title');
  document.getElementById('edit-question-id').value = question ? (question._id || question.id) : '';
  document.getElementById('modal-question-text').value = question ? (question.question || question.questionText) : '';
  
  for (let i = 0; i < 4; i++) {
    document.getElementById(`modal-option-${i}`).value = question && question.options ? question.options[i] : '';
  }
  document.getElementById('modal-correct-answer').value = question ? (question.answer !== undefined ? question.answer : question.correctAnswer) : '0';
  
  title.textContent = question ? 'Edit Question' : 'Add New Question';
  modal.classList.remove('hidden');
}

function closeQuestionModal() {
  document.getElementById('questionModal').classList.add('hidden');
}

window.editQuestion = function(q) {
  openQuestionModal(q);
};

	window.deleteQuestion = async function(id) {
	  if (!confirm('Are you sure you want to delete this question?')) return;
	  try {
		const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
		const data = await res.json();
		if (data.success) {
		  const manageTopicSelect = document.getElementById('teacher-manage-topic-select');
		  const topic = manageTopicSelect ? manageTopicSelect.value : 'default';
		  loadQuestionsForTopic(topic);
		} else {
		  alert(data.message || 'Failed to delete');
		}
	  } catch (err) {
		alert('Error deleting question');
	  }
	};


	// --- Chapter Management Frontend Handlers ---

// Store chapters globally for safe index-based lookup
	window.currentChapters = [];

	async function loadChapters() {
	  try {
		const res = await fetch('/api/chapters');
		const data = await res.json();
		const tbody = document.getElementById('chapter-table-body');
		if (!tbody) return;

		if (!data.success || data.chapters.length === 0) {
		  tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-xs text-slate-500">No chapters added yet.</td></tr>`;
		  return;
		}

		// Save chapters globally so we can reference them safely by index
		window.currentChapters = data.chapters;

		tbody.innerHTML = data.chapters.map((chap, index) => `
		  <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
			<td class="px-4 py-3 font-mono text-xs text-indigo-300">${chap.chapterId}</td>
			<td class="px-4 py-3 text-xs font-medium text-white">${chap.title}</td>
			<td class="px-4 py-3 text-xs text-slate-300"><span class="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">${chap.topic}</span></td>
			<td class="px-4 py-3 text-xs text-slate-400 truncate max-w-xs">${chap.content}</td>
			<td class="px-4 py-3 text-right space-x-2">
			  <button onclick="editChapterByIndex(${index})" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs transition-colors">Edit</button>
			  <button onclick="deleteChapter('${chap._id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs transition-colors">Delete</button>
			</td>
		  </tr>
		`).join('');
	  } catch (err) {
		console.error('Failed to load chapters:', err);
	  }
	}

	window.editChapterByIndex = function(index) {
	  const chap = window.currentChapters[index];
	  if (!chap) return;

	  document.getElementById('chapter-modal-title').textContent = 'Edit Chapter';
	  document.getElementById('edit-chapter-mongo-id').value = chap._id;
	  
	  // Populate the topic dropdown with teacher's assigned topics, selecting the current chapter's topic
	  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
	  const topics = currentUser.assignedTopics && currentUser.assignedTopics.length > 0 ? currentUser.assignedTopics : ['default'];
	  const topicSelect = document.getElementById('modal-chapter-topic');
	  if (topicSelect) {
		topicSelect.innerHTML = topics.map(t => `<option value="${t}" ${t === chap.topic ? 'selected' : ''}>${t}</option>`).join('');
	  }

	  document.getElementById('modal-chapter-title').value = chap.title;
	  document.getElementById('modal-chapter-content').value = chap.content;
	  document.getElementById('chapterModal').classList.remove('hidden');
	};

	window.openChapterModal = function() {
	  document.getElementById('chapter-modal-title').textContent = 'Add New Chapter';
	  document.getElementById('edit-chapter-mongo-id').value = '';
	  document.getElementById('chapterForm').reset();

	  // Populate topic dropdown using teacher's assigned topics
	  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
	  const topics = currentUser.assignedTopics && currentUser.assignedTopics.length > 0 ? currentUser.assignedTopics : ['default'];
	  
	  const topicSelect = document.getElementById('modal-chapter-topic');
	  if (topicSelect) {
		topicSelect.innerHTML = topics.map(t => `<option value="${t}">${t}</option>`).join('');
	  }

	  document.getElementById('chapterModal').classList.remove('hidden');
	};

	window.closeChapterModal = function() {
	  document.getElementById('chapterModal').classList.add('hidden');
	};


window.handleChapterSubmit = async function(e) {
  e.preventDefault();
  const mongoId = document.getElementById('edit-chapter-mongo-id').value;
  const chapterData = {
    title: document.getElementById('modal-chapter-title').value,
    topic: document.getElementById('modal-chapter-topic').value,
    content: document.getElementById('modal-chapter-content').value
  };

  const url = mongoId ? `/api/chapters/${mongoId}` : '/api/chapters';
  const method = mongoId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chapterData)
    });
    const data = await res.json();
    if (data.success) {
      closeChapterModal();
      loadChapters();
    } else {
      alert(data.message || 'Operation failed');
    }
  } catch (err) {
    console.error('Error saving chapter:', err);
  }
};

window.deleteChapter = async function(mongoId) {
  if (!confirm('Are you sure you want to delete this chapter?')) return;
  try {
    const res = await fetch(`/api/chapters/${mongoId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadChapters();
    } else {
      alert(data.message || 'Failed to delete chapter');
    }
  } catch (err) {
    console.error('Error deleting chapter:', err);
  }
};

function escapeHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}


function showTeacherPodiumModal(leaderboard) {
  const sorted = [...leaderboard].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.totalTime || 0) - (b.totalTime || 0);
  });
  
  const top1 = sorted[0] || { name: 'N/A', score: 0, totalTime: 0 };
  const top2 = sorted[1] || { name: 'N/A', score: 0, totalTime: 0 };
  const top3 = sorted[2] || { name: 'N/A', score: 0, totalTime: 0 };

  const existingModal = document.getElementById('podium-celebration-modal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="podium-celebration-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div class="bg-slate-900 border border-purple-500/40 p-8 rounded-3xl w-full max-w-lg shadow-2xl text-center relative overflow-hidden space-y-6">
        
        <div class="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex justify-center mb-2">
          <img src="../../images/celebration.gif" alt="Celebration" class="w-24 h-24 object-contain rounded-2xl shadow-lg border border-white/10" />
        </div>

        <div>
          <h2 class="text-2xl font-bold text-white tracking-tight">🏆 Quiz Winners Podium 🏆</h2>
          <p class="text-xs text-slate-400 mt-1">Ranked by highest score, with total time as tie-breaker</p>
        </div>

        <div class="grid grid-cols-3 gap-3 items-end pt-2">
          
          <!-- 2nd Place -->
          <div class="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col items-center justify-center space-y-1 shadow-md transform -translate-y-2">
            <span class="text-3xl animate-bounce"><img src="../images/rank-2.png" alt="1st Place" class="w-16 h-16 object-contain mb-1 animate-bounce" /></span>
            <div class="text-[11px] font-semibold text-slate-300 truncate w-full" title="${top2.name}">${top2.name}</div>
            <div class="text-xs font-bold text-slate-200">${top2.score} pts</div>
            <div class="text-[10px] text-slate-400">(${top2.totalTime || 0}s)</div>
            <div class="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-1">2nd Place</div>
          </div>

          <!-- 1st Place -->
          <div class="p-5 rounded-2xl bg-gradient-to-b from-amber-500/20 to-purple-600/20 border border-amber-500/40 flex flex-col items-center justify-center space-y-1.5 shadow-xl transform -translate-y-4">
            <span class="text-3xl animate-bounce"><img src="../images/rank-1.png" alt="1st Place" class="w-16 h-16 object-contain mb-1 animate-bounce" /></span>
            <div class="text-xs font-bold text-white truncate w-full" title="${top1.name}">${top1.name}</div>
            <div class="text-sm font-extrabold text-amber-300">${top1.score} pts</div>
            <div class="text-[11px] text-amber-200/80">(${top1.totalTime || 0}s)</div>
            <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold mt-1">1st Place</div>
          </div>

          <!-- 3rd Place -->
          <div class="p-4 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col items-center justify-center space-y-1 shadow-md">
            <span class="text-3xl animate-bounce"><img src="../images/rank-3.png" alt="1st Place" class="w-16 h-16 object-contain mb-1 animate-bounce" /></span>
            <div class="text-[11px] font-semibold text-slate-300 truncate w-full" title="${top3.name}">${top3.name}</div>
            <div class="text-xs font-bold text-slate-200">${top3.score} pts</div>
            <div class="text-[10px] text-slate-400">(${top3.totalTime || 0}s)</div>
            <div class="text-[9px] uppercase tracking-wider text-amber-600 font-bold mt-1">3rd Place</div>
          </div>

        </div>

        <button onclick="document.getElementById('podium-celebration-modal').remove()" class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all">
          Close Podium & View Full Leaderboard
        </button>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}