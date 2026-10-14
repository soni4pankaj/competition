// --- Topic Master Management Script ---

async function loadTopicsMaster() {
  try {
    const res = await fetch('/api/admin/topics');
    const data = await res.json();
    
    if (data.success) {
      const checkboxContainer = document.getElementById('user-topics-checkboxes');
      const editCheckboxContainer = document.getElementById('edit-user-topics-checkboxes');
      const tagsContainer = document.getElementById('topic-tags-container');

      if (checkboxContainer) checkboxContainer.innerHTML = '';
      if (editCheckboxContainer) editCheckboxContainer.innerHTML = '';
      if (tagsContainer) tagsContainer.innerHTML = '';

      if (data.topics.length === 0) {
        if (checkboxContainer) checkboxContainer.innerHTML = '<span class="text-xs text-slate-500">No topics found. Add one above!</span>';
        if (editCheckboxContainer) editCheckboxContainer.innerHTML = '<span class="text-xs text-slate-500">No topics found.</span>';
        return;
      }

      data.topics.forEach(t => {
        // Render tag badges in Admin Dashboard
        if (tagsContainer) {
          tagsContainer.innerHTML += `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium">
              ${t.name}
            </span>
          `;
        }

        // Render checkboxes for Create User Form
        if (checkboxContainer) {
          checkboxContainer.innerHTML += `
            <label class="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input type="checkbox" name="selectedTopics" value="${t.name}" class="topic-checkbox accent-purple-500 rounded">
              <span>${t.name}</span>
            </label>
          `;
        }

        // Render checkboxes for Edit User Modal
        if (editCheckboxContainer) {
          editCheckboxContainer.innerHTML += `
            <label class="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input type="checkbox" name="editSelectedTopics" value="${t.name}" class="edit-topic-checkbox accent-purple-500 rounded">
              <span>${t.name}</span>
            </label>
          `;
        }
      });
    }
  } catch (err) {
    console.error('Failed to load topic list:', err);
  }
}

// Handle adding new topic via form submission
document.addEventListener('DOMContentLoaded', () => {
  const createTopicForm = document.getElementById('createTopicForm');
  if (createTopicForm) {
    createTopicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-topic-name');
      const name = nameInput.value.trim();
      
      try {
        const res = await fetch('/api/admin/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        
        if (data.success) {
          nameInput.value = '';
          loadTopicsMaster(); // Refresh master list & checkboxes immediately
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert('Error adding topic');
      }
    });
  }
});