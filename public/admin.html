// admin.js

// --- STATE MANAGEMENT ---
// Store data globally to avoid re-fetching unless necessary
let allUsers = [];
let allBands = [];
let allSongs = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Security Check: Ensure the user is a logged-in site admin
    if (!checkAccess()) {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }

    const user = getUserPayload();
    if (user.role !== 'site_admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }

    // If security checks pass, show the admin content
    document.getElementById('admin-content').style.display = 'block';

    // 2. Attach Event Listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('create-band-form').addEventListener('submit', handleCreateBand);
    document.getElementById('confirm-reassign-btn').addEventListener('click', handleConfirmReassignment);
    document.getElementById('confirm-copy-btn').addEventListener('click', handleConfirmCopy);
    
    // Add event listener to the table body for delegation
    document.getElementById('users-table-body').addEventListener('click', handleUserActions);

    // 3. Load Initial Data
    initializeAdminPanel();
});


// --- DATA FETCHING ---
async function initializeAdminPanel() {
    try {
        // Fetch all data in parallel for efficiency
        [allUsers, allBands, allSongs] = await Promise.all([
            apiRequest('site-admin/users'),
            apiRequest('site-admin/bands'),
            apiRequest('site-admin/songs')
        ]);
        
        populateUsersTable();
        
    } catch (error) {
        console.error("Failed to initialize admin panel:", error);
        alert(`Error: ${error.message}`);
    }
}

// --- RENDERING FUNCTIONS ---
function populateUsersTable() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = ''; // Clear existing rows

    if (allUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-gray-400">No users found.</td></tr>';
        return;
    }

    allUsers.forEach(user => {
        const band = allBands.find(b => b.id === user.band_id);
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700';
        row.innerHTML = `
            <td class="p-3">${user.email}</td>
            <td class="p-3">${band ? band.band_name : 'N/A'}</td>
            <td class="p-3">${user.role}</td>
            <td class="p-3">
                <button 
                    class="btn btn-secondary btn-sm"
                    data-action="reassign"
                    data-userid="${user.id}"
                    data-email="${user.email}"
                >Reassign</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function populateSelectDropdown(selectElement, items, valueField, textField) {
    selectElement.innerHTML = '';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        selectElement.appendChild(option);
    });
}

// --- MODAL MANAGEMENT ---
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

// Make closeModal globally accessible for the onclick attributes in the HTML
window.closeModal = closeModal;

// --- EVENT HANDLERS ---
function handleUserActions(event) {
    const button = event.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'reassign') {
        const userId = button.dataset.userid;
        const userEmail = button.dataset.email;
        openReassignUserModal(userId, userEmail);
    }
}

function openReassignUserModal(userId, userEmail) {
    document.getElementById('reassign-user-email').textContent = userEmail;
    document.getElementById('confirm-reassign-btn').dataset.userId = userId;
    
    const bandSelect = document.getElementById('reassign-band-select');
    populateSelectDropdown(bandSelect, allBands, 'id', 'band_name');
    
    openModal('reassign-user-modal');
}

function openCopySongModal() {
    const songSelect = document.getElementById('copy-song-select');
    populateSelectDropdown(songSelect, allSongs, 'id', 'title');

    const bandSelect = document.getElementById('copy-band-select');
    populateSelectDropdown(bandSelect, allBands, 'id', 'band_name');

    openModal('copy-song-modal');
}

async function handleCreateBand(event) {
    event.preventDefault();
    const statusEl = document.getElementById('create-band-status');
    const submitBtn = document.getElementById('create-band-btn');
    const bandNameInput = document.getElementById('band-name');
    const adminEmailInput = document.getElementById('admin-email');

    const bandName = bandNameInput.value.trim();
    const adminEmail = adminEmailInput.value.trim();

    if (!bandName || !adminEmail) {
        statusEl.textContent = 'All fields are required.';
        statusEl.style.color = '#f87171';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    statusEl.textContent = '';

    try {
        await apiRequest('site-admin/create-band', { bandName, adminEmail }, 'POST');
        statusEl.textContent = `Successfully created band '${bandName}' and sent invite to ${adminEmail}.`;
        statusEl.style.color = '#4ade80';
        bandNameInput.value = '';
        adminEmailInput.value = '';
        initializeAdminPanel(); // Refresh all data
    } catch (error) {
        statusEl.textContent = error.message;
        statusEl.style.color = '#f87171';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Band & Send Invite';
    }
}

async function handleConfirmReassignment() {
    const button = document.getElementById('confirm-reassign-btn');
    const userId = button.dataset.userId;
    const bandId = document.getElementById('reassign-band-select').value;
    
    button.disabled = true;
    button.textContent = 'Reassigning...';

    try {
        await apiRequest('site-admin/reassign-user', { userId, newBandId: bandId }, 'POST');
        closeModal('reassign-user-modal');
        await initializeAdminPanel(); // Refresh the table
        alert('User reassigned successfully!');
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Confirm Reassignment';
    }
}

async function handleConfirmCopy() {
    const button = document.getElementById('confirm-copy-btn');
    const songId = document.getElementById('copy-song-select').value;
    const targetBandId = document.getElementById('copy-band-select').value;

    button.disabled = true;
    button.textContent = 'Copying...';

    try {
        await apiRequest('site-admin/copy-song', { songId, targetBandId }, 'POST');
        closeModal('copy-song-modal');
        alert('Song copied successfully!');
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Copy Song';
    }
}
