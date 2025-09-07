document.addEventListener('DOMContentLoaded', () => {
    const user = getUserPayload();
    if (!user || (user.role !== 'band_admin' && user.role !== 'admin')) {
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    
    document.getElementById('band-content').style.display = 'block';
    loadBandDetails();
    loadBandMembers();
    
    document.getElementById('add-member-form').addEventListener('submit', handleAddMember);
});

async function loadBandDetails() {
    const nameHeader = document.getElementById('band-name-header');
    const idDisplay = document.getElementById('band-id-display');
    try {
        const details = await apiRequest('band', null, 'GET');
        if (details) {
            nameHeader.textContent = details.band_name || 'Your Band';
            idDisplay.textContent = `Band Number: ${details.band_number || 'N/A'}`;
        }
    } catch(error) {
        idDisplay.textContent = `Could not load band info.`;
    }
}

async function loadBandMembers() {
    const tableBody = document.getElementById('members-table-body');
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">Loading...</td></tr>`;
    try {
        const members = await apiRequest('band/members', null, 'GET');
        tableBody.innerHTML = '';
        if (members.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No members found.</td></tr>`;
            return;
        }
        members.forEach(member => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            const name = (member.first_name && member.last_name && member.first_name !== 'New') ? `${member.first_name} ${member.last_name}` : 'Pending Signup';
            const roleDisplay = member.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

            let actionsHtml = '';
            if (member.role !== 'band_admin' && member.role !== 'admin') {
                actionsHtml = `<button class="btn btn-danger btn-sm" onclick="removeMember('${member.email}')">Remove</button>`;
            }

            row.innerHTML = `
                <td class="p-3">${member.email}</td>
                <td class="p-3 text-gray-400">${name}</td>
                <td class="p-3 text-gray-400">${roleDisplay}</td>
                <td class="p-3">${actionsHtml}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
         tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Failed to load members: ${error.message}</td></tr>`;
    }
}

async function handleAddMember(event) {
    event.preventDefault();
    const statusEl = document.getElementById('add-member-status');
    const button = event.target.querySelector('button[type="submit"]');
    const originalButtonText = button.textContent;
    
    statusEl.textContent = 'Adding member...';
    statusEl.className = 'text-sm mt-3 h-5 text-yellow-400';
    button.disabled = true;
    button.textContent = 'Adding...';

    const payload = {
        firstName: document.getElementById('new-member-firstname').value,
        lastName: document.getElementById('new-member-lastname').value,
        email: document.getElementById('new-member-email').value,
    };

    try {
        const result = await apiRequest('band/members', payload, 'POST');
        alert(`Member added!\n\nPlease send them the following credentials:\nEmail: ${payload.email}\nPassword: ${result.message.split(': ')[1]}`);
        
        statusEl.textContent = 'Member added successfully!';
        statusEl.className = 'text-sm mt-3 h-5 text-green-400';
        event.target.reset();
        loadBandMembers();
    } catch(error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'text-sm mt-3 h-5 text-red-500';
    } finally {
         button.disabled = false;
         button.textContent = originalButtonText;
    }
}

async function removeMember(userEmail) {
    if (confirm(`Are you sure you want to remove ${userEmail} from the band? They will lose access immediately.`)) {
        try {
            await apiRequest('band/members', { emailToRemove: userEmail }, 'DELETE');
            loadBandMembers();
        } catch(error) {
            alert(`Failed to remove member: ${error.message}`);
        }
    }
}
