// --- Admin User Management Script ---

document.addEventListener('DOMContentLoaded', () => {
  // Fetch and render users for Admin
  window.loadAdminUsers = async function() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        const tbody = document.getElementById('userTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.users.forEach(user => {
          const topicsStr = Array.isArray(user.assignedTopics) ? user.assignedTopics.join(', ') : (user.assignedQuiz || 'default');
          tbody.innerHTML += `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td class="px-4 py-3 text-xs text-slate-200">${user.username}</td>
              <td class="px-4 py-3 text-xs text-slate-300 capitalize">${user.role}</td>
              <td class="px-4 py-3 text-xs text-purple-300">${topicsStr}</td>
              <td class="px-4 py-3 text-xs text-right space-x-2">
                <button onclick='openEditModal("${user._id}", ${JSON.stringify(user.username)}, "${user.role}", ${JSON.stringify(user.assignedTopics || [])})' class="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all">Edit</button>
                <button onclick="deleteUser('${user._id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all">Delete</button>
              </td>
            </tr>
          `;
        });
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  // Create New User Handler
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('new-username').value.trim();
      const password = document.getElementById('new-password').value.trim();
      const role = document.getElementById('new-role').value;
      
      const checkedBoxes = document.querySelectorAll('input[name="selectedTopics"]:checked');
      const assignedTopics = Array.from(checkedBoxes).map(cb => cb.value);

      if (assignedTopics.length === 0) {
        alert('Please select at least one topic for the user.');
        return;
      }

      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, assignedTopics })
        });
        const data = await res.json();
        if (data.success) {
          alert('User created successfully!');
          createUserForm.reset();
          document.querySelectorAll('input[name="selectedTopics"]').forEach(cb => cb.checked = false);
          loadAdminUsers();
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert('Error creating user.');
      }
    });
  }

  // Delete User Handler
  window.deleteUser = async function(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadAdminUsers();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error deleting user.');
    }
  };

  // Edit Modal Controllers
  window.openEditModal = function(id, username, role, assignedTopics) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-password').value = '';
    document.getElementById('edit-role').value = role;

    const editCheckboxes = document.querySelectorAll('input[name="editSelectedTopics"]');
    editCheckboxes.forEach(cb => {
      cb.checked = Array.isArray(assignedTopics) && assignedTopics.includes(cb.value);
    });

    document.getElementById('editModal').classList.remove('hidden');
  };

  window.closeEditModal = function() {
    document.getElementById('editModal').classList.add('hidden');
  };

  // Edit User Form Submission Handler
  const editUserForm = document.getElementById('editUserForm');
  if (editUserForm) {
    editUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-user-id').value;
      const username = document.getElementById('edit-username').value.trim();
      const password = document.getElementById('edit-password').value.trim();
      const role = document.getElementById('edit-role').value;

      const checkedBoxes = document.querySelectorAll('input[name="editSelectedTopics"]:checked');
      const assignedTopics = Array.from(checkedBoxes).map(cb => cb.value);

      if (assignedTopics.length === 0) {
        alert('Please select at least one topic for the user.');
        return;
      }

      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, assignedTopics })
        });
        const data = await res.json();
        if (data.success) {
          alert('User updated successfully!');
          closeEditModal();
          loadAdminUsers();
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert('Error updating user.');
      }
    });
  }
});