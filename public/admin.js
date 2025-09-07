document.addEventListener('DOMContentLoaded', () => {
    // This is a protected admin page. The getUserPayload function is in auth_proanthem.js
    const user = getUserPayload();
    if (!user || user.role !== 'admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    
    // If the user is an admin, show the content and fetch the data.
    document.getElementById('admin-content').style.display = 'block';
    loadUsers();
});

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

            const roleOptions = ['free', 'pro', 'admin']
                .map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role.charAt(0).toUpperCase() + role.slice(1)}</option>`)
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
                    <button class="bg-red-600 text-white text-sm py-1 px-3 rounded hover:bg-red-700" onclick="deleteUser('${user.email}')">
                        Delete User
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
        loadUsers();
        return;
    }
    try {
        await apiRequest('admin-tasks/update-role', { email, newRole }, 'POST');
        alert('User role updated successfully.');
        loadUsers();
    } catch (error) {
        alert(`Error updating role: ${error.message}`);
        loadUsers();
    }
}

async function deleteUser(email) {
    if (!confirm(`ARE YOU SURE you want to permanently delete the user ${email}? This will delete their account but their songs and setlists will remain. This action CANNOT be undone.`)) {
        return;
    }
    try {
        await apiRequest('admin-tasks/delete-user', { email }, 'POST');
        alert('User deleted successfully.');
        loadUsers();
    } catch (error) {
        alert(`Error deleting user: ${error.message}`);
    }
}
