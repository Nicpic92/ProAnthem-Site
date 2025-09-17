// --- START OF FILE public/js/dashboard.js ---
import { getUserPayload, checkAccess } from './auth.js';
import { apiRequest, getTransactions, createTransaction, updateTransaction, deleteTransaction, getMerchItems, createMerchItem, updateMerchItem, deleteMerchItem } from './api.js';

let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAccess()) return;
    const user = getUserPayload();
    if (!user || !user.band_id) {
        document.getElementById('dashboard-content').style.display = 'none';
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    initializeDashboard(user);
});

async function initializeDashboard(user) {
    isAdmin = user.role === 'admin' || user.role === 'band_admin';
    document.getElementById('dashboard-content').style.display = 'block';
    document.getElementById('welcome-message').textContent = `Welcome, ${user.name}!`;

    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }

    setupTabs();
    setupEventListeners();

    loadOverviewData();
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
    document.getElementById('save-announcements-btn')?.addEventListener('click', saveAnnouncements);
    document.getElementById('add-transaction-btn')?.addEventListener('click', () => openTransactionModal(null));
    document.getElementById('transaction-form')?.addEventListener('submit', handleSaveTransaction);
    document.getElementById('add-merch-btn')?.addEventListener('click', () => openMerchModal(null));
    document.getElementById('merch-form')?.addEventListener('submit', handleSaveMerchItem);
}

// --- OVERVIEW TAB LOGIC ---
async function loadOverviewData() {
    try {
        const data = await apiRequest('band-dashboard');
        document.getElementById('band-name-header').textContent = `${data.band.band_name} Dashboard`;
        document.getElementById('announcements-view').textContent = data.band.announcements || 'No announcements yet.';
        document.getElementById('announcements-textarea').value = data.band.announcements || '';
        
        const eventsList = document.getElementById('events-list');
        eventsList.innerHTML = '';
        if (data.events && data.events.length > 0) {
            data.events.forEach(event => {
                const eventDate = new Date(event.event_date);
                eventsList.innerHTML += `<div class="p-3 bg-gray-800/50 rounded-lg"><p class="font-bold">${event.title}</p><p class="text-sm text-gray-400">${eventDate.toLocaleString()}</p></div>`;
            });
        } else {
            eventsList.innerHTML = '<p class="text-gray-400">No upcoming events.</p>';
        }
    } catch (error) { alert(`Error loading dashboard: ${error.message}`); }
}

async function saveAnnouncements() {
    const btn = document.getElementById('save-announcements-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;
    try {
        const newContent = document.getElementById('announcements-textarea').value;
        await apiRequest('band-dashboard/announcements', { content: newContent }, 'PUT');
        document.getElementById('announcements-view').textContent = newContent || 'No announcements yet.';
    } catch (error) { alert(`Failed to save: ${error.message}`); } 
    finally { btn.textContent = 'Save Announcements'; btn.disabled = false; }
}

// --- FINANCES TAB LOGIC ---
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
            row.className = 'border-b border-gray-700';
            row.innerHTML = `
                <td class="p-3">${new Date(t.transaction_date).toLocaleDateString()}</td>
                <td class="p-3">${t.description}</td>
                <td class="p-3">${t.category}</td>
                <td class="p-3 text-right ${amount >= 0 ? 'text-green-400' : 'text-red-400'}">${amount.toFixed(2)}</td>
                <td class="p-3 text-right admin-only ${isAdmin ? '' : 'hidden'}">
                    <button class="text-sm hover:underline" data-action="edit">Edit</button>
                    <button class="text-sm hover:underline text-red-400 ml-2" data-action="delete">Delete</button>
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

function openTransactionModal(t) {
    document.getElementById('transaction-modal-title').textContent = t ? 'Edit Transaction' : 'Add Transaction';
    document.getElementById('transaction-id').value = t ? t.id : '';
    document.getElementById('transaction-date').value = t ? new Date(t.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('transaction-description').value = t ? t.description : '';
    document.getElementById('transaction-amount').value = t ? t.amount : '';
    document.getElementById('transaction-category').value = t ? t.category : 'Venue Payout';
    document.getElementById('transaction-modal').classList.remove('hidden');
}

async function handleSaveTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('transaction-id').value;
    const payload = {
        transaction_date: document.getElementById('transaction-date').value,
        description: document.getElementById('transaction-description').value,
        amount: document.getElementById('transaction-amount').value,
        category: document.getElementById('transaction-category').value
    };
    try {
        if (id) { await updateTransaction(id, payload); } 
        else { await createTransaction(payload); }
        document.getElementById('transaction-modal').classList.add('hidden');
        loadFinances();
    } catch(error) { alert(`Save failed: ${error.message}`); }
}

// --- MERCH TAB LOGIC ---
async function loadMerch() {
    const tableBody = document.getElementById('merch-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Loading...</td></tr>`;
    try {
        const items = await getMerchItems();
        tableBody.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700';
            row.innerHTML = `
                <td class="p-3">${item.item_name}</td>
                <td class="p-3">${item.variant_name || 'N/A'}</td>
                <td class="p-3 text-right">${item.price ? `$${parseFloat(item.price).toFixed(2)}` : 'N/A'}</td>
                <td class="p-3 text-right">${item.stock_quantity}</td>
                <td class="p-3 text-right admin-only ${isAdmin ? '' : 'hidden'}">
                    <button class="text-sm hover:underline" data-action="edit">Edit</button>
                    <button class="text-sm hover:underline text-red-400 ml-2" data-action="delete">Delete</button>
                </td>`;
            row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openMerchModal(item));
            row.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
                if(confirm('Delete this item?')) { await deleteMerchItem(item.id); loadMerch(); }
            });
            tableBody.appendChild(row);
        });
    } catch (error) { tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Failed to load merch.</td></tr>`; }
}

function openMerchModal(item) {
    document.getElementById('merch-modal-title').textContent = item ? 'Edit Merch Item' : 'Add Merch Item';
    document.getElementById('merch-id').value = item ? item.id : '';
    document.getElementById('merch-item-name').value = item ? item.item_name : '';
    document.getElementById('merch-variant-name').value = item ? item.variant_name : '';
    document.getElementById('merch-price').value = item ? item.price : '';
    document.getElementById('merch-stock').value = item ? item.stock_quantity : '';
    document.getElementById('merch-modal').classList.remove('hidden');
}

async function handleSaveMerchItem(e) {
    e.preventDefault();
    const id = document.getElementById('merch-id').value;
    const payload = {
        item_name: document.getElementById('merch-item-name').value,
        variant_name: document.getElementById('merch-variant-name').value,
        price: document.getElementById('merch-price').value || null,
        stock_quantity: document.getElementById('merch-stock').value
    };
    try {
        if (id) { await updateMerchItem(id, payload); }
        else { await createMerchItem(payload); }
        document.getElementById('merch-modal').classList.add('hidden');
        loadMerch();
    } catch(error) { alert(`Save failed: ${error.message}`); }
}
// --- END OF FILE public/js/dashboard.js ---
