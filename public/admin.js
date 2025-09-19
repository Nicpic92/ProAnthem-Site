// --- START OF FILE public/admin.js ---

import { getUserPayload } from './js/auth.js';
import { apiRequest } from './js/api.js';

let allBands = [];
let allSongs = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = getUserPayload();
    if (!user || user.permissions.role !== 'admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    
    document.getElementById('admin-content').style.display = 'block';
    
    try {
        allBands = await apiRequest('admin-tasks/bands');
        allSongs = await apiRequest('admin-tasks/songs');
    } catch(e) {
        console.error("Failed to pre-fetch admin data", e);
        alert("Could not load initial admin data. Some features may not work.");
    }
    
    loadUsers();

    document.getElementById('add-user-btn').addEventListener('click', openAddUserModal);
    document.getElementById('add-user-form').addEventListener('submit', confirmAddUser);
});

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Loading users...</td></tr>`;

    try {
        const users = await apiRequest('admin-tasks/users'); 
        tableBody.innerHTML = '';
        // FIXED: Use the actual role names from the database schema
        const roles = ['free', 'solo', 'band_member', 'editor', 'band_admin', 'admin', 'inactive'];

        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            
            const roleOptions = roles.map(role => 
                `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>`
            ).join('');

            row.innerHTML = `
                <td class="p-3">${user.email}</td>
                <td class="p-3 text-gray-400">${user.band_name || 'N/A'} (ID: ${user.band_id || 'N/A'})</td>
                <td class="p-3">
                    <select class="form-select form-input text-sm" data-email="${user.email}">${roleOptions}</select>
                </td>
                <td class="p-3 space-x-2 whitespace-nowrap">
                    <button class="btn btn-sm btn-secondary" data-action="save-role" data-email="${user.email}">Save</button>
                    <button class="btn btn-sm" data-action="reassign" data-email="${user.email}">Reassign</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-email="${user.email}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        tableBody.querySelectorAll('button[data-action="save-role"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.target.dataset.email;
                const selectEl = tableBody.querySelector(`select[data-email="${email}"]`);
                handleUpdateRole(email, selectEl.value);
            });
        });
        tableBody.querySelectorAll('button[data-action="reassign"]').forEach(btn => {
            btn.addEventListener('click', (e) => openReassignModal(e.target.dataset.email));
        });
        tableBody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteUser(e.target.dataset.email));
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Failed to load users: ${error.message}</td></tr>`;
    }
}

async function handleUpdateRole(email, newRoleName) {
    if (!confirm(`Are you sure you want to change ${email}'s role to ${newRoleName}?`)) return;
    try {
        // FIXED: Send 'newRoleName' in the payload
        await apiRequest('admin-tasks/update-role', { email, newRoleName }, 'POST');
        alert('Role updated successfully!');
        loadUsers();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function handleDeleteUser(email) {
    if (!confirm(`ARE YOU SURE you want to permanently delete the user ${email}? This action cannot be undone.`)) return;
    try {
        await apiRequest('admin-tasks/delete-user', { email }, 'POST');
        alert('User deleted successfully!');
        loadUsers();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function openAddUserModal() {
    document.getElementById('add-user-form').reset();
    const bandSelect = document.getElementById('add-user-band');
    bandSelect.innerHTML = allBands.map(band => `<option value="${band.id}">${band.band_name}</option>`).join('');
    openModal('add-user-modal');
}

async function confirmAddUser(event) {
    event.preventDefault();
    const payload = {
        firstName: document.getElementById('add-user-firstname').value,
        lastName: document.getElementById('add-user-lastname').value,
        email: document.getElementById('add-user-email').value,
        // FIXED: Send 'roleName'
        roleName: document.getElementById('add-user-role').value,
        bandId: document.getElementById('add-user-band').value,
    };
    try {
        const result = await apiRequest('admin-tasks/add-user', payload, 'POST');
        alert(`User created!\n\nIMPORTANT: Please provide the following temporary password to the user:\n\n${result.temporaryPassword}`);
        closeModal('add-user-modal');
        loadUsers();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function openReassignModal(email) {
    document.getElementById('reassign-user-email').textContent = email;
    const select = document.getElementById('reassign-band-select');
    select.innerHTML = allBands.map(band => `<option value="${band.id}">${band.band_name} (ID: ${band.id})</option>`).join('');
    
    document.getElementById('confirm-reassign-btn').onclick = () => confirmReassignment(email);
    openModal('reassign-user-modal');
}

async function confirmReassignment(email) {
    const newBandId = document.getElementById('reassign-band-select').value;
    if (!newBandId) {
        alert("Please select a band.");
        return;
    }
    try {
        await apiRequest('admin-tasks/reassign-user', { email, newBandId }, 'POST');
        alert('User reassigned successfully!');
        closeModal('reassign-user-modal');
        loadUsers();
    } catch(error) {
        alert(`Error: ${error.message}`);
    }
}

function openCopySongModal() {
    const songSelect = document.getElementById('copy-song-select');
    songSelect.innerHTML = '<option value="">-- Select a Song --</option>' + allSongs.map(song => 
        `<option value="${song.id}">${song.title} by ${song.artist || 'Unknown'} (from Band: ${song.band_name})</option>`
    ).join('');
    
    const bandSelect = document.getElementById('copy-band-select');
    bandSelect.innerHTML = '<option value="">-- Select a Target Band --</option>' + allBands.map(band => 
        `<option value="${band.id}">${band.band_name}</option>`
    ).join('');
    
    document.getElementById('confirm-copy-btn').onclick = confirmCopySong;
    openModal('copy-song-modal');
}

async function confirmCopySong() {
    const songId = document.getElementById('copy-song-select').value;
    const targetBandId = document.getElementById('copy-band-select').value;
    
    if(!songId || !targetBandId) {
        alert("Please select both a song and a target band.");
        return;
    }
    
    try {
        await apiRequest('admin-tasks/copy-song', { songId, targetBandId }, 'POST');
        alert('Song copied successfully!');
        closeModal('copy-song-modal');
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

window.openCopySongModal = openCopySongModal;
window.closeModal = closeModal;
