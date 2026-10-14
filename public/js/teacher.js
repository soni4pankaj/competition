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

  // Socket listeners for teacher room & lobby updates
  setTimeout(() => {
    if (typeof socket !== 'undefined') {
      socket.on('room_ready', ({ qrCode, roomId }) => {
        const qrImg = document.getElementById('lobby-qr-img');
        const lobbyCard = document.getElementById('teacher-lobby-card');
        if (qrImg) qrImg.src = qrCode;
        if (lobbyCard) lobbyCard.classList.remove('hidden');
      });

      socket.on('lobby_update', ({ players }) => {
        const countEl = document.getElementById('lobby-student-count');
        if (countEl) countEl.textContent = players.length;
        
        const list = document.getElementById('lobby-student-list');
        if (list) {
          list.innerHTML = '';
          const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
          sortedPlayers.forEach((p, index) => {
            list.innerHTML += `
              <li class="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-200">
                <span class="font-semibold">#${index + 1} ${p.name}</span>
                <span class="font-bold text-white">${p.score} pts</span>
              </li>
            `;
          });
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
  document.getElementById('modal-correct-answer').value = question ? (question.answer !== undefined ? question.answer : q.correctAnswer) : '0';
  
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