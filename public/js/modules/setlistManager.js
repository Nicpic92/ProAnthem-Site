// --- START OF FILE public/js/modules/setlistManager.js ---

import * as api from '/js/api.js';
import * as UI from './ui.js';
import { getUserPayload } from '/js/auth.js';

let isDemo = false;
let currentSongData = null; // To hold the currently loaded song from the editor

const el = {};

function cacheDOMElements() {
    el.setlistBtn = document.getElementById('setlistBtn');
    el.setlistModal = document.getElementById('setlistModal');
    el.closeSetlistModalBtn = document.getElementById('closeSetlistModalBtn');
    el.setlistSelector = document.getElementById('setlistSelector');
    el.createSetlistBtn = document.getElementById('createSetlistBtn');
    el.cloneSetlistBtn = document.getElementById('clone-setlist-btn');
    el.addSongToSetlistBtn = document.getElementById('addSongToSetlistBtn');
    el.printSetlistBtn = document.getElementById('printSetlistBtn');
    el.newSetlistInput = document.getElementById('newSetlistInput');
    el.songsInSetlist = document.getElementById('songsInSetlist');
    el.currentSetlistTitle = document.getElementById('currentSetlistTitle');
    el.setlistDetailsSection = document.getElementById('setlistDetailsSection');
    el.saveSetlistDetailsBtn = document.getElementById('saveSetlistDetailsBtn');
    el.deleteSetlistBtn = document.getElementById('deleteSetlistBtn');
    el.printDrummerSetlistBtn = document.getElementById('printDrummerSetlistBtn');
    el.setlistNoteForm = document.getElementById('setlistNoteForm');
    el.newSetlistNoteInput = document.getElementById('newSetlistNoteInput');
    el.addSetlistNoteBtn = document.getElementById('addSetlistNoteBtn');
    el.newSetlistNoteDuration = document.getElementById('newSetlistNoteDuration');
    el.setlistTotalTime = document.getElementById('setlistTotalTime');
    el.startShowBtn = document.getElementById('start-show-btn');
    el.addSongToSetlistSection = document.getElementById('add-song-to-setlist-section');
    el.addSongSelect = document.getElementById('add-song-select');
    el.addSelectedSongBtn = document.getElementById('add-selected-song-btn');
}

export function init(isDemoMode) {
    isDemo = isDemoMode;
    cacheDOMElements();
    attachEventListeners();
}

function attachEventListeners() {
    const user = getUserPayload();
    const canUseSetlists = user && user.permissions && user.permissions.can_use_setlists;
    
    if (el.setlistBtn) {
        if (!canUseSetlists && !isDemo) {
            el.setlistBtn.textContent = 'Show Builder (Upgrade)';
            el.setlistBtn.title = 'Upgrade to a paid plan to use the Show Builder.';
            el.setlistBtn.classList.add('opacity-50', 'cursor-not-allowed');
            el.setlistBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/pricing.html';
            });
        } else {
             el.setlistBtn.addEventListener('click', openSetlistManager);
        }
    }
    
    el.closeSetlistModalBtn?.addEventListener('click', () => el.setlistModal.classList.add('hidden'));
    el.setlistSelector?.addEventListener('change', (e) => handleSetlistSelection(e.target.value));
    el.saveSetlistDetailsBtn?.addEventListener('click', handleSaveSetlistDetails);
    el.createSetlistBtn?.addEventListener('click', handleCreateSetlist);
    el.cloneSetlistBtn?.addEventListener('click', handleCloneSetlist);
    el.addSongToSetlistBtn?.addEventListener('click', handleAddSongToSetlist);
    el.printSetlistBtn?.addEventListener('click', () => handlePrintSetlist(false));
    el.printDrummerSetlistBtn?.addEventListener('click', () => handlePrintSetlist(true));
    el.deleteSetlistBtn?.addEventListener('click', handleDeleteSetlist);
    el.songsInSetlist?.addEventListener('click', (e) => { if (e.target.dataset.action === 'remove-item') handleRemoveItemFromSetlist(e.target.closest('li')); });
    el.addSetlistNoteBtn?.addEventListener('click', handleAddSetlistNote);
    el.startShowBtn?.addEventListener('click', handleStartShow);
    el.addSelectedSongBtn?.addEventListener('click', handleAddSongFromBuilder);
}

export function updateCurrentSong(songData) {
    currentSongData = songData;
    if (el.setlistSelector && el.setlistSelector.value) {
        el.addSongToSetlistBtn.disabled = !currentSongData || !currentSongData.id;
    }
}

async function openSetlistManager() {
    if (document.querySelector('.main-content-area')?.classList.contains('hidden') && !isDemo) return;

    el.setlistModal.classList.remove('hidden');
    try {
        const allSongs = isDemo ? [{id: 'demo-song', title: 'The ProAnthem Feature Tour', artist: 'The Dev Team'}] : await api.getSheets();
        el.addSongSelect.innerHTML = '<option value="">-- Select a song to add --</option>';
        allSongs.forEach(song => {
            const option = document.createElement('option');
            option.value = song.id;
            option.textContent = `${song.title || 'Untitled'} (${song.artist || 'Unknown'})`;
            el.addSongSelect.appendChild(option);
        });
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), 'Failed to load song library.', true);
    }
    await loadSetlists();
    handleSetlistSelection(null);
}

async function loadSetlists(selectId = null) {
    try {
        const lists = isDemo ? [{id: 1, name: "Demo Setlist"}] : await api.getSetlists();
        el.setlistSelector.innerHTML = '<option value="">-- Select a Setlist --</option>';
        lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            el.setlistSelector.appendChild(option);
        });
        if (selectId) {
            el.setlistSelector.value = selectId;
            await handleSetlistSelection(selectId);
        }
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), 'Failed to load setlists.', true);
    }
}

async function handleSetlistSelection(setlistId) {
    if (el.songsInSetlist.sortableInstance) {
        el.songsInSetlist.sortableInstance.destroy();
        el.songsInSetlist.sortableInstance = null;
    }

    const buttonsToManage = [el.addSongToSetlistBtn, el.addSelectedSongBtn, el.printSetlistBtn, el.printDrummerSetlistBtn, el.deleteSetlistBtn, el.startShowBtn, el.cloneSetlistBtn];

    if (!setlistId) {
        el.currentSetlistTitle.textContent = 'Select a setlist';
        el.setlistDetailsSection.classList.add('hidden');
        el.setlistNoteForm.classList.add('hidden');
        el.addSongToSetlistSection.classList.add('hidden');
        el.songsInSetlist.innerHTML = '';
        el.setlistTotalTime.textContent = '';
        buttonsToManage.forEach(b => { if(b) b.disabled = true; });
        return;
    }

    try {
        const setlist = isDemo ? {name: "Demo Setlist", songs: [], notes: "{}"} : await api.getSetlist(setlistId);
        el.currentSetlistTitle.textContent = setlist.name;
        document.getElementById('setlistVenue').value = setlist.venue || '';
        document.getElementById('setlistDate').value = setlist.event_date ? setlist.event_date.split('T')[0] : '';
        document.getElementById('setlistLogoUrl').value = setlist.logo_url || '';
        let extraData = { order: [], notes: [] };
        try { const notesField = document.getElementById('setlistNotes'); notesField.value = setlist.notes || ''; const parsedNotes = JSON.parse(setlist.notes || '{}'); if (parsedNotes.order && Array.isArray(parsedNotes.notes)) extraData = parsedNotes; } catch (e) {}
        el.setlistDetailsSection.classList.remove('hidden');
        el.setlistNoteForm.classList.remove('hidden');
        el.addSongToSetlistSection.classList.remove('hidden');
        el.songsInSetlist.innerHTML = '';
        const allItemsMap = new Map(); (setlist.songs || []).forEach(s => allItemsMap.set(s.id.toString(), { ...s, type: 'song' })); (extraData.notes || []).forEach(n => allItemsMap.set(n.id.toString(), n));
        const orderedItems = (extraData.order.length > 0 ? extraData.order : (setlist.songs || []).map(s => s.id)) .map(id => String(id)).map(id => allItemsMap.get(id)).filter(Boolean);
        orderedItems.forEach(item => { const li = document.createElement('li'); li.className = 'flex justify-between items-center p-2 bg-gray-700 rounded cursor-grab'; const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 
