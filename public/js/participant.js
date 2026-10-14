// --- Participant Quiz & Timer Script ---

document.addEventListener('DOMContentLoaded', () => {
  window.loadedQuestions = [];
  window.timerInterval = null;

  // Timer Countdown Function
  function startQuizTimer(durationInSeconds) {
    let timer = durationInSeconds;
    const timerDisplay = document.getElementById('time-remaining');
    
    if (window.timerInterval) clearInterval(window.timerInterval);

    window.timerInterval = setInterval(() => {
      let minutes = Math.floor(timer / 60);
      let seconds = timer % 60;

      minutes = minutes < 10 ? '0' + minutes : minutes;
      seconds = seconds < 10 ? '0' + seconds : seconds;

      if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds}`;

      if (--timer < 0) {
        clearInterval(window.timerInterval);
        alert('Time is up! Submitting your quiz automatically.');
        if (typeof window.submitQuiz === 'function') window.submitQuiz();
      }
    }, 1000);
  }

  // Load Participant Quiz based on Assigned Category
  window.loadParticipantQuiz = async function(category) {
    try {
      const res = await fetch(`/api/questions?category=${category}`);
      const data = await res.json();
      
      window.loadedQuestions = data.questions || [];
      const titleEl = document.getElementById('quiz-category-title');
      if (titleEl) titleEl.textContent = `Assigned Category: ${data.category.toUpperCase()}`;
      
      const container = document.getElementById('quiz-container');
      if (!container) return;
      container.innerHTML = '';

      if (window.loadedQuestions.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">No questions found for this category.</p>`;
        const submitContainer = document.getElementById('submit-btn-container');
        if (submitContainer) submitContainer.classList.add('hidden');
        return;
      }

      window.loadedQuestions.forEach((q, index) => {
        let optionsHtml = q.options.map((opt, optIdx) => `
          <label class="block p-3 rounded-xl bg-slate-950/40 border border-white/5 hover:border-purple-500/50 cursor-pointer text-xs text-slate-200 transition-all">
            <input type="radio" name="question-${index}" value="${optIdx}" class="mr-2 accent-purple-500">
            ${opt}
          </label>
        `).join('');

        container.innerHTML += `
          <div class="p-6 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl space-y-3">
            <h3 class="text-sm font-semibold text-white">Q${index + 1}. ${q.question}</h3>
            <div class="space-y-2">${optionsHtml}</div>
          </div>
        `;
      });

      startQuizTimer(120);

    } catch (err) {
      console.error('Failed to load quiz questions:', err);
    }
  };

  // Reusable Quiz Submission & Scoring Function
  window.submitQuiz = function() {
    if (window.timerInterval) clearInterval(window.timerInterval);

    let score = 0;
    let total = window.loadedQuestions.length;

    window.loadedQuestions.forEach((q, index) => {
      const selectedOption = document.querySelector(`input[name="question-${index}"]:checked`);
      if (selectedOption) {
        const selectedVal = parseInt(selectedOption.value);
        if (selectedVal === q.answer) {
          score++;
        }
      }
    });

    const quizContainer = document.getElementById('quiz-container');
    const submitBtnContainer = document.getElementById('submit-btn-container');
    const scoreText = document.getElementById('quiz-score-text');
    const resultCard = document.getElementById('quiz-result-card');

    if (quizContainer) quizContainer.classList.add('hidden');
    if (submitBtnContainer) submitBtnContainer.classList.add('hidden');
    if (scoreText) scoreText.textContent = `You scored ${score} out of ${total} correct!`;
    if (resultCard) resultCard.classList.remove('hidden');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  const submitQuizBtn = document.getElementById('submit-quiz-btn');
  if (submitQuizBtn) {
    submitQuizBtn.addEventListener('click', window.submitQuiz);
  }
});