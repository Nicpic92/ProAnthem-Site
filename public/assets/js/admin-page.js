document.addEventListener('DOMContentLoaded', () => {
    const user = getUserPayload();
    if (!user || user.role !== 'admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    
    document.getElementById('admin-content').style.display = 'block';
    
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', handleCreateUser);
    }
    
    loadUsers();
});

async function handleCreateUser(event) {
    event.preventDefault();
    const statusEl = document.getElementById('create-user-status');
    const button = event.target.querySelector('button[type="submit"]');
    const originalButtonText = button.textContent;

    statusEl.textContent = 'Creating user...';
    statusEl.className = 'text-sm mt-3 h-5 text-yellow-400';
    button.disabled = true;
    button.textContent = 'Creating...';

    const email = document.getElementById('new-email').value;
    const bandName = document.getElementById('new-bandname').value;
    
    try {
        const result = await apiRequest('admin-tasks/create-user', { email, bandName }, 'POST');
        statusEl.textContent = result.message;
        statusEl.className = 'text-sm mt-3 h-5 text-green-400';
        document.getElementById('create-user-form').reset();
        loadUsers();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'text-sm mt-3 h-5 text-red-500';
    } finally {
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Loading users...</td></tr>`;

    try {
        const users = await apiRequest('admin-tasks/users'); 
        tableBody.innerHTML = '';

        if(users.length === 0) {
             tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">No users found.</td></tr>`;
             return;
        }

        users.forEach(user => {
            const signupDate = new Date(user.created_at).toLocaleDateString();
            const userRow = document.createElement('tr');
            userRow.className = 'border-b border-gray-700 hover:bg-gray-700/50';

            const roleOptions = ['solo', 'band_admin', 'admin']
                .map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>`)
                .join('');
            
            userRow.innerHTML = `
                <td class="p-3">${user.email}</td>
                <td class="p-3 text-gray-400">${user.band_name || 'N/A'}</td>
                <td class="p-3">
                    <select class="form-select bg-gray-700 w-full p-2 border border-gray-600 rounded-md" onchange="changeUserRole('${user.email}', this.value)">
                        ${roleOptions}
                    </select>
                </td>
                <td class="p-3 text-gray-400">${signupDate}</td>
                <td class="p-3">
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.email}')">
                        Delete
                    </button>
                </td>
            `;
            tableBody.appendChild(userRow);
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Failed to load users: ${error.message}</td></tr>`;
        console.error('Failed to load users:', error);
    }
}

async function changeUserRole(email, newRole) {
    if (!confirm(`Are you sure you want to change the role for ${email} to "${newRole}"?`)) {
        loadUsers(); // Reload to reset the dropdown if the user cancels
        return;
    }
    try {
        await apiRequest('admin-tasks/update-role', { email, newRole }, 'POST');
        alert('User role updated successfully.');
        // No need to reload here, the UI is already updated. A success message is enough.
    } catch (error) {
        alert(`Error updating role: ${error.message}`);
        loadUsers(); // Reload to reset the UI state on error
    }
}

async function deleteUser(email) {
    if (!confirm(`ARE YOU SURE you want to permanently delete the user ${email}? This action CANNOT be undone.`)) {
        return;
    }
    try {
        await apiRequest('admin-tasks/delete-user', { email }, 'POST');
        alert('User deleted successfully.');
        loadUsers(); // Reload the list to remove the deleted user
    } catch (error) {
        alert(`Error deleting user: ${error.message}`);
    }
}
