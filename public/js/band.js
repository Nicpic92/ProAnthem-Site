// --- START OF FILE public/js/band.js ---

import { getUserPayload, checkAccess } from './auth.js';
import { 
    getBandDetails, getBandMembers, addBandMember, removeBandMember,
    getBandProfile, updateBandProfile,
    getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    getTransactions, createTransaction, updateTransaction, deleteTransaction,
    getMerchItems, createMerchItem, updateMerchItem, deleteMerchItem
} from './api.js';

let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAccess()) return;
    const user = getUserPayload();
    if (!user || !user.band_id) {
        // This check is important for solo users who might try to access the page
        document.getElementById('band-content').style.display = 'none';
        document.getElementById('access-denied').innerHTML = `
            <h2 class="text-3xl font-bold text-red-500">Page Not Available</h2>
            <p class="mt-4 text-lg text-gray-300">This page is for users who are part of a band.</p>
            <a href="/dashboard.html" class="btn btn-primary mt-6">Return to Dashboard</a>`;
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    initializeBandPage(user);
});

function initializeBandPage(user) {
    isAdmin = user.role === 'admin' || user.role === 'band_admin';

    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = el.tagName === 'TH' ? 'table-cell' : '';
        });
    }

    setupTabs();
    setupEventListeners();

    // Load data for all tabs
    loadBandDetails();
    loadBandMembers();
    loadBandProfile();
    loadCalendarEvents();
    loadFinances();
    loadMerch();
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
        });
    });
}

function setupEventListeners() {
    // Member Event Listeners
    document.getElementById('add-member-form').addEventListener('submit', handleAddMember);
    document.getElementById('copy-link-btn').addEventListener('click', copyInviteLink);

    // Profile Event Listeners
    document.getElementById('profile-form').addEventListener('submit', handleSaveProfile);
    // document.getElementById('add-photo-btn').addEventListener('click', () => addPhotoInput('', true));

    // Calendar Event Listeners
    document.getElementById('add-event-btn').addEventListener('click', () => openEventModal(null));
    document.getElementById('event-form').addEventListener('submit', handleSaveEvent);
    document.getElementById('cancel-event-btn').addEventListener('click', () => closeModal('event-modal'));
    document.getElementById('delete-event-btn').addEventListener('click', handleDeleteEvent);

    // Finances Event Listeners
    document.getElementById('add-transaction-btn').addEventListener('click', () => openTransactionModal(null));
    document.getElementById('transaction-form').addEventListener('submit', handleSaveTransaction);
    
    // Merch Event Listeners
    document.getElementById('add-merch-btn').addEventListener('click', () => openMerchModal(null));
    document.getElementById('merch-form').addEventListener('submit', handleSaveMerchItem);
}

async function loadBandDetails() {
    try {
        const details = await getBandDetails();
        document.getElementById('band-name-header').textContent = details.band_name || 'Your Band';
        document.getElementById('band-id-display').textContent = `Band Number: ${details.band_number || 'N/A'}`;
    } catch(error) {
        document.getElementById('band-id-display').textContent = `Could not load band info.`;
    }
}

// --- ALL OTHER FUNCTIONS ---
// The following are the functions for each tab's logic.
// They are consolidated here from your previous `band.html` and the `dashboard.js` script.

// --- MEMBERS LOGIC ---
async function loadBandMembers() { /* ... function remains the same ... */ }
async function handleAddMember(event) { /* ... function remains the same ... */ }
function copyInviteLink() { /* ... function remains the same ... */ }
async function removeMember(userEmail) { /* ... function remains the same ... */ }

// --- PROFILE LOGIC ---
async function loadBandProfile() { /* ... function remains the same ... */ }
async function handleSaveProfile(event) { /* ... function remains the same ... */ }
// function addPhotoInput(url, isAdmin) { /* ... function remains the same ... */ }

// --- CALENDAR LOGIC ---
async function loadCalendarEvents() { /* ... function remains the same ... */ }
function openEventModal(event) { /* ... function remains the same ... */ }
async function handleSaveEvent(event) { /* ... function remains the same ... */ }
async function handleDeleteEvent() { /* ... function remains the same ... */ }

// --- FINANCES LOGIC (Moved from old dashboard.js) ---
async function loadFinances() {
    const tableBody = document.getElementById('transactions-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>`;
    try {
        const transactions = await getTransactions();
        let total = 0;
        tableBody.innerHTML = '';
        transactions.forEach(t => {
            const amount = parseFloat(t.amount);
            total += amount;
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800';
            row.innerHTML = `
                <td class="p-3">${new Date(t.transaction_date).toLocaleDateString()}</td>
                <td class="p-3">${t.description}</td>
                <td class="p-3 text-gray-400">${t.category}</td>
                <td class="p-3 text-right font-mono ${amount >= 0 ? 'text-green-400' : 'text-red-400'}">${amount.toFixed(2)}</td>
                <td class="p-3 text-right admin-only" style="display: ${isAdmin ? '' : 'none'}">
                    <button class="text-sm text-indigo-400 hover:underline" data-action="edit">Edit</button>
                    <button class="text-sm text-red-400 hover:underline ml-2" data-action="delete">Delete</button>
                </td>`;
            row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openTransactionModal(t));
            row.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
                if(confirm('Delete this transaction?')) { await deleteTransaction(t.id); loadFinances(); }
            });
            tableBody.appendChild(row);
        });
        const balanceEl = document.getElementById('total-balance');
        balanceEl.textContent = `$${total.toFixed(2)}`;
        balanceEl.className = total >= 0 ? 'text-green-400' : 'text-red-400';
    } catch (error) { tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Failed to load transactions.</td></tr>`; }
}
function openTransactionModal(t) { /* ... function remains the same ... */ }
async function handleSaveTransaction(e) { /* ... function remains the same ... */ }

// --- MERCH LOGIC (Moved from old dashboard.js) ---
async function loadMerch() { /* ... function remains the same ... */ }
function openMerchModal(item) { /* ... function remains the same ... */ }
async function handleSaveMerchItem(e) { /* ... function remains the same ... */ }


// --- END OF FILE public/js/band.js ---
