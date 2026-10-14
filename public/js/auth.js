// --- Authentication & Session Management Script ---

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('input-username');
  const passwordInput = document.getElementById('input-password');
  const errorBox = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');

  // Fast Demo Buttons
  const demoAdminBtn = document.getElementById('demo-admin-btn');
  if (demoAdminBtn) {
    demoAdminBtn.addEventListener('click', () => {
      usernameInput.value = 'admin';
      passwordInput.value = 'admin123';
    });
  }

  const demoUserBtn = document.getElementById('demo-user-btn');
  if (demoUserBtn) {
    demoUserBtn.addEventListener('click', () => {
      usernameInput.value = 'user1';
      passwordInput.value = 'user123';
    });
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.add('hidden');

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.value.trim(),
            password: passwordInput.value.trim()
          })
        });

        const data = await res.json();

        if (data.success) {
          localStorage.setItem('currentUser', JSON.stringify(data.user));

          // Redirect teacher to dedicated dashboard file
          if (data.user.role === 'teacher') {
            window.location.href = '/teacher-dashboard';
            return;
          }

          document.getElementById('view-login').classList.add('hidden');
          document.getElementById('main-header').classList.remove('hidden');

          document.getElementById('header-user-name').textContent = data.user.username;
          document.getElementById('header-user-role').textContent = data.user.role;

          if (data.user.role === 'admin') {
            document.getElementById('view-admin').classList.remove('hidden');
            if (typeof loadAdminUsers === 'function') loadAdminUsers();
            if (typeof loadTopicsMaster === 'function') loadTopicsMaster();
          } else {
            document.getElementById('view-participant').classList.remove('hidden');
            const topics = data.user.assignedTopics || ['default'];
            if (typeof loadParticipantQuiz === 'function') loadParticipantQuiz(topics[0]);
          }
        } else {
          errorText.textContent = data.message || 'Invalid login details';
          errorBox.classList.remove('hidden');
        }
      } catch (err) {
        errorText.textContent = 'Server connection error';
        errorBox.classList.remove('hidden');
      }
    });
  }

  // Logout Handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.reload();
    });
  }
});