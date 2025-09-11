let allBands = [];
let allSongs = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = getUserPayload();
    if (!user || user.role !== 'admin') {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    
    document.getElementById('admin-content').style.display = 'block';
    
    try {
        allBands = await apiRequest('admin-tasks/bands', null, 'GET');
        allSongs = await apiRequest('admin-tasks/songs', null, 'GET');
    } catch(e) {
        console.error("Failed to pre-fetch admin data", e);
        alert("Could not load initial admin data. Some features may not work.");
    }
    
    loadUsers();
});

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

async function loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Loading users...</td></tr>`;

    try {
        const users = await apiRequest('admin-tasks/users'); 
        tableBody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            
            const roleDisplay = user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

            row.innerHTML = `
                <td class="p-3">${user.email}</td>
                <td class="p-3 text-gray-400">${user.band_name || 'N/A'} (ID: ${user.band_id || 'N/A'})</td>
                <td class="p-3">${roleDisplay}</td>
                <td class="p-3 space-x-2">
                    <button class="text-blue-400 hover:underline" onclick="openReassignModal('${user.email}')">Reassign Band</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Failed to load users: ${error.message}</td></tr>`;
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
