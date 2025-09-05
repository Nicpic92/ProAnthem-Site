document.addEventListener('DOMContentLoaded', () => {
    // This is a protected admin page.
    const role = getUserRole();
    if (role !== 'admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    
    // If the user is an admin, show the content and fetch the data.
    document.getElementById('admin-content').style.display = 'block';
    loadUsers();

    // Add event listener for closing the modal
    document.getElementById('close-modal-button').addEventListener('click', () => {
        document.getElementById('manage-user-modal').style.display = 'none';
    });
});

async function loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    try {
        const users = await apiRequest('admin-users'); // This is a GET request, so it works fine with the new default
        tableBody.innerHTML = ''; // Clear "Loading..."

        users.forEach(user => {
            const signupDate = new Date(user.created_at).toLocaleDateString();
            const userRow = document.createElement('tr');

            const roleOptions = ['free', 'pro', 'admin']
                .map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role.charAt(0).toUpperCase() + role.slice(1)}</option>`)
                .join('');
            
            userRow.innerHTML = `
                <td class="p-3">${user.email}</td>
                <td class="p-3">
                    <select class="w-full p-2 border rounded-md" onchange="changeUserRole('${user.email}', this.value)">
                        ${roleOptions}
                    </select>
                </td>
                <td class="p-3">${signupDate}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2 flex-wrap">
                        <button class="bg-blue-500 text-white text-sm py-1 px-3 rounded hover:bg-blue-600" onclick="openManageModal('${user.email}')">
                            Custom Tools
                        </button>
                        <button class="bg-red-600 text-white text-sm py-1 px-3 rounded hover:bg-red-700" onclick="deleteUser('${user.email}')">
                            Delete
                        </button>
                        <button class="bg-purple-600 text-white text-sm py-1 px-3 rounded hover:bg-purple-700" onclick="migrateUser('${user.email}')">
                            Migrate to PA
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(userRow);
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Failed to load users.</td></tr>`;
        console.error('Failed to load users:', error);
    }
}

async function changeUserRole(email, newRole) {
    if (!confirm(`Are you sure you want to change the role for ${email} to "${newRole}"?`)) {
        loadUsers(); // Revert dropdown if canceled
        return;
    }
    try {
        await apiRequest('update-user-role', { email, newRole }, 'POST');
        alert('User role updated successfully.');
        loadUsers(); // Refresh the list
    } catch (error) {
        alert(`Error updating role: ${error.message}`);
        loadUsers(); // Revert dropdown on error
    }
}

async function deleteUser(email) {
    if (!confirm(`ARE YOU SURE you want to permanently delete the user ${email}? This action cannot be undone.`)) {
        return;
    }
    try {
        await apiRequest('delete-user', { email }, 'POST');
        alert('User deleted successfully.');
        loadUsers(); // Refresh the list
    } catch (error) {
        alert(`Error deleting user: ${error.message}`);
    }
}

// --- NEW MIGRATION FUNCTION ---
async function migrateUser(email) {
    if (!confirm(`Migrate all ProAnthem data (songs, setlists) for ${email} to the new ProAnthem site? This will copy their data and create an account for them on the new site if one doesn't exist. This action cannot be undone.`)) {
        return;
    }

    // IMPORTANT: This URL must be the full production URL of your NEW ProAnthem site.
    const proAnthemApiUrl = 'https://proanthem.com/api/migrate-user';

    try {
        const response = await fetch(proAnthemApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('user_token')}` // Send the admin token
            },
            body: JSON.stringify({ email: email })
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'An unknown error occurred during migration.');
        }

        alert(`Successfully migrated user: ${email}. They can now log in to ProAnthem with their existing password.`);

    } catch (error) {
        alert(`Migration failed: ${error.message}`);
        console.error('Migration error:', error);
    }
}


async function openManageModal(email) {
    const modal = document.getElementById('manage-user-modal');
    const modalEmail = document.getElementById('modal-user-email');
    const modalToolsList = document.getElementById('modal-tools-list');

    modalEmail.textContent = email;
    modalToolsList.innerHTML = '<p>Loading custom tools...</p>';
    modal.style.display = 'block';

    try {
        const encodedEmail = encodeURIComponent(email);
        const data = await apiRequest(`admin-user/${encodedEmail}`); 
        const tools = data.custom_tools;
        modalToolsList.innerHTML = '';

        if (tools.length === 0) {
            modalToolsList.innerHTML = '<p>No custom tools are available.</p>';
            return;
        }

        tools.forEach(tool => {
            const toolToggle = `
                <div class="flex items-center justify-between p-2 border-b">
                    <span>${tool.name}</span>
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" 
                               onchange="toggleToolAccess('${email}', ${tool.id}, this.checked)"
                               ${tool.has_access ? 'checked' : ''}>
                        <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            `;
            modalToolsList.innerHTML += toolToggle;
        });

    } catch (error) {
        modalToolsList.innerHTML = '<p class="text-red-500">Could not load tool access data.</p>';
        console.error('Failed to load user tool data:', error);
    }
}

async function toggleToolAccess(user_email, tool_id, hasAccess) {
    const endpoint = hasAccess ? 'admin-assign-tool' : 'admin-revoke-tool';
    try {
        await apiRequest(endpoint, { user_email, tool_id }, 'POST');
    } catch (error) {
        alert('Failed to update tool access. Please try again.');
        openManageModal(user_email); 
    }
}
