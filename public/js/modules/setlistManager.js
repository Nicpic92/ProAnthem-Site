// --- START OF FILE public/js/modules/setlistManager.js ---

import * as api from '/js/api.js';
import * as UI from './ui.js';
import { getUserPayload } from '/js/auth.js';

let isDemo = false;
let currentSongData = null; // To hold the currently loaded song from the editor

const el = {};

// --- HELPER FUNCTIONS FOR PDF TAB RENDERING (COPIED FROM FRETBOARD.JS) ---
const PDF_TUNINGS = { E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, DROP_C: { name: "Drop C", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'C'] } };
const PDF_FRETBOARD_CONFIG = { nutWidth: 15 };

function renderTransposedTabForPDF(tabBlock, song) {
    if (!tabBlock.data || !tabBlock.data.notes || tabBlock.data.notes.length === 0) {
        return 'No tab data.';
    }
    const numStrings = tabBlock.strings || 6;
    const tuningInfo = PDF_TUNINGS[song.tuning];
    const stringNames = tuningInfo?.strings?.slice(0, numStrings) || Array(numStrings).fill('?');
    const totalOffset = (tuningInfo?.offset ?? 0) + (song.capo ?? 0) + (song.transpose ?? 0);
    const CHARACTER_WIDTH = 12;
    const timeline = new Map();

    tabBlock.data.notes.forEach(note => {
        if (note.string >= numStrings) return;
        const transposedFret = note.fret - totalOffset;
        if (transposedFret < 0) return;
        const charPosition = Math.max(0, Math.floor((note.position - PDF_FRETBOARD_CONFIG.nutWidth) / CHARACTER_WIDTH));
        if (!timeline.has(charPosition)) {
            timeline.set(charPosition, []);
        }
        timeline.get(charPosition).push({ string: note.string, fret: transposedFret.toString() });
    });

    if (timeline.size === 0) return 'Notes out of range for current settings.';
    
    const sortedPositions = [...timeline.keys()].sort((a, b) => a - b);
    const lines = stringNames.map(name => `${name.padEnd(2, ' ')}|-`);
    let lastCharPos = 0;
    sortedPositions.forEach(charPos => {
        const notesAtPos = timeline.get(charPos);
        const maxWidth = notesAtPos.reduce((max, note) => Math.max(max, note.fret.length), 1);
        const padding = charPos - lastCharPos - 1;
        if (padding > 0) {
            for (let i = 0; i < numStrings; i++) lines[i] += '-'.repeat(padding);
        }
        for (let i = 0; i < numStrings; i++) {
            const noteOnString = notesAtPos.find(n => n.string === i);
            const displayChar = noteOnString ? noteOnString.fret : '-';
            lines[i] += displayChar.padEnd(maxWidth, '-');
        }
        lastCharPos = charPos + maxWidth - 1;
    });
    for (let i = 0; i < numStrings; i++) lines[i] += '-|';
    return lines.join('\n');
}
// --- END HELPER FUNCTIONS ---


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
        orderedItems.forEach(item => { const li = document.createElement('li'); li.className = 'flex justify-between items-center p-2 bg-gray-700 rounded cursor-grab'; const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`; if (item.type === 'song') { li.dataset.itemId = item.id; li.dataset.itemType = 'song'; const duration = item.duration || '0:00'; const keyInfo = getSongKeyInfo(item); li.dataset.duration = duration; li.innerHTML = `<div class="flex-grow"><span>${gripHandle}${item.title} - <em class="text-gray-400">${item.artist}</em></span><div class="text-xs text-indigo-300 ml-6">${keyInfo}</div></div><div class="flex items-center gap-4"><span class="font-mono text-sm">${duration}</span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button></div>`; } else { li.dataset.itemId = item.id; li.dataset.itemType = 'note'; const duration = item.duration || '0:00'; li.dataset.duration = duration; li.classList.add('bg-gray-750', 'border', 'border-dashed', 'border-gray-600'); li.innerHTML = `<div class="flex-grow"><span>${gripHandle}<em class="text-indigo-300">${item.title}</em></span></div><div class="flex items-center gap-4"><span class="font-mono text-sm">${duration}</span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button></div>`; } el.songsInSetlist.appendChild(li); });
        recalculateSetlistTime();
        if (typeof Sortable !== 'undefined') {
            el.songsInSetlist.sortableInstance = new Sortable(el.songsInSetlist, { animation: 150, ghostClass: 'sortable-ghost', onEnd: saveSetlistOrderAndNotes });
        }
        buttonsToManage.forEach(b => { if (b) b.disabled = false; });
        el.addSongToSetlistBtn.disabled = !currentSongData || !currentSongData.id;
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Failed to load setlist details: ${error.message}`, true);
    }
}

async function saveSetlistOrderAndNotes() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); recalculateSetlistTime(); return; }
    const setlistId = el.setlistSelector.value;
    if (!setlistId) return;
    UI.setStatus(document.getElementById('statusMessage'), 'Saving setlist...');
    const listItems = Array.from(el.songsInSetlist.children);
    const song_ids = [];
    const notes = [];
    const order = [];
    listItems.forEach(li => { const id = li.dataset.itemId; const type = li.dataset.itemType; order.push(id); if (type === 'song') { song_ids.push(id); } else if (type === 'note') { notes.push({ id: id, type: 'note', title: li.querySelector('em').textContent, duration: li.dataset.duration }); } });
    const extraDataPayload = { order, notes };
    document.getElementById('setlistNotes').value = JSON.stringify(extraDataPayload);
    try {
        await Promise.all([ api.updateSetlistSongOrder(setlistId, song_ids), handleSaveSetlistDetails() ]);
        UI.setStatus(document.getElementById('statusMessage'), 'Setlist saved!', false);
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Error saving setlist: ${error.message}`, true);
        await handleSetlistSelection(setlistId);
    } finally {
        recalculateSetlistTime();
    }
}

async function handleSaveSetlistDetails() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); return; }
    const setlistId = el.setlistSelector.value;
    if (!setlistId) return;
    const payload = { name: el.currentSetlistTitle.textContent, venue: document.getElementById('setlistVenue').value, event_date: document.getElementById('setlistDate').value, logo_url: document.getElementById('setlistLogoUrl').value, notes: document.getElementById('setlistNotes').value };
    try {
        await api.updateSetlistDetails(setlistId, payload);
        UI.setStatus(document.getElementById('statusMessage'), 'Setlist details saved!', false);
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Error saving details: ${error.message}`, true);
    }
}

async function handleCreateSetlist() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); return; }
    const name = el.newSetlistInput.value.trim();
    if (!name) return alert('Please enter a name for the new setlist.');
    try {
        const newSetlist = await api.createSetlist({ name });
        el.newSetlistInput.value = '';
        UI.setStatus(document.getElementById('statusMessage'), 'Setlist created!', false);
        await loadSetlists(newSetlist.id);
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Error creating setlist: ${error.message}`, true);
    }
}

async function handleCloneSetlist() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Cloning is disabled in the demo.', true); return; }
    const setlistId = el.setlistSelector.value;
    if (!setlistId) { alert('Please select a setlist to clone.'); return; }
    const originalName = el.setlistSelector.options[el.setlistSelector.selectedIndex].text;
    const newName = prompt(`Enter a name for the new cloned setlist:`, `${originalName} (Copy)`);
    if (!newName || newName.trim() === '') return;
    try {
        UI.setStatus(document.getElementById('statusMessage'), 'Cloning...');
        const newSetlist = await api.cloneSetlist(setlistId, newName);
        UI.setStatus(document.getElementById('statusMessage'), 'Setlist cloned successfully!', false);
        await loadSetlists(newSetlist.id);
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Failed to clone setlist: ${error.message}`, true);
    }
}

async function handleDeleteSetlist() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); return; }
    const setlistId = el.setlistSelector.value;
    const setlistName = el.setlistSelector.options[el.setlistSelector.selectedIndex].text;
    if (!setlistId) return;
    if (confirm(`ARE YOU SURE you want to permanently delete the setlist "${setlistName}"? This cannot be undone.`)) {
        try {
            await api.deleteSetlist(setlistId);
            UI.setStatus(document.getElementById('statusMessage'), `Setlist "${setlistName}" deleted.`, false);
            await loadSetlists();
            handleSetlistSelection(null);
        } catch(error) {
            UI.setStatus(document.getElementById('statusMessage'), `Failed to delete setlist: ${error.message}`, true);
        }
    }
}

async function handleAddSongToSetlist() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); return; }
    const setlistId = el.setlistSelector.value;
    if (!currentSongData || !currentSongData.id) return alert('Please save the current song before adding it to a setlist.');
    if (!setlistId) return alert('Please select a setlist first.');
    try {
        await api.addSongToSetlist(setlistId, currentSongData.id);
        UI.setStatus(document.getElementById('statusMessage'), `'${currentSongData.title}' added to setlist.`, false);
        await handleSetlistSelection(setlistId);
    } catch(error) {
        UI.setStatus(document.getElementById('statusMessage'), `Failed to add song: ${error.message}`, true);
    }
}

async function handleAddSongFromBuilder() {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); return; }
    const setlistId = el.setlistSelector.value;
    const songId = el.addSongSelect.value;
    if (!setlistId) { alert('Please select a setlist first.'); return; }
    if (!songId) { alert('Please select a song from the dropdown to add.'); return; }
    const songTitle = el.addSongSelect.options[el.addSongSelect.selectedIndex].text;
    try {
        await api.addSongToSetlist(setlistId, songId);
        UI.setStatus(document.getElementById('statusMessage'), `'${songTitle}' added to setlist.`, false);
        await handleSetlistSelection(setlistId);
        el.addSongSelect.value = '';
    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Failed to add song: ${error.message}`, true);
    }
}

async function handleRemoveItemFromSetlist(itemLi) {
    if (isDemo) { UI.setStatus(document.getElementById('statusMessage'), 'Setlists not saved in demo.'); itemLi.remove(); recalculateSetlistTime(); return; }
    const setlistId = el.setlistSelector.value;
    const itemId = itemLi.dataset.itemId;
    const itemType = itemLi.dataset.itemType;
    if (!setlistId || !itemId) return;
    if (confirm("Are you sure you want to remove this item from the setlist?")) {
        try {
            if (itemType === 'song') {
                await api.removeSongFromSetlist(setlistId, itemId);
            }
            itemLi.remove();
            await saveSetlistOrderAndNotes();
        } catch(error) {
            UI.setStatus(document.getElementById('statusMessage'), `Failed to remove item: ${error.message}`, true);
            await handleSetlistSelection(setlistId);
        }
    }
}

function handleAddSetlistNote() {
    const noteText = el.newSetlistNoteInput.value.trim();
    const noteDuration = el.newSetlistNoteDuration.value.trim();
    if (!noteText) return;
    const noteId = `note_${Date.now()}`;
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center p-2 bg-gray-750 border border-dashed border-gray-600 rounded cursor-grab';
    li.dataset.itemId = noteId;
    li.dataset.itemType = 'note';
    li.dataset.duration = noteDuration || '0:00';
    const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;
    li.innerHTML = `<div class="flex-grow"><span>${gripHandle}<em class="text-indigo-300">${noteText}</em></span></div><div class="flex items-center gap-4"><span class="font-mono text-sm">${noteDuration || '0:00'}</span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button></div>`;
    el.songsInSetlist.appendChild(li);
    el.newSetlistNoteInput.value = '';
    el.newSetlistNoteDuration.value = '';
    saveSetlistOrderAndNotes();
}

function parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) { return (parts[0] * 60) + (parts[1] || 0); }
    if (parts.length === 1) { return parts[0]; }
    return 0;
}

function formatSecondsToTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    let timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (h > 0) { timeStr = `${h}:${timeStr}`; }
    return timeStr;
}

function recalculateSetlistTime() {
    const items = document.querySelectorAll('#songsInSetlist li');
    let totalSeconds = 0;
    items.forEach(item => { totalSeconds += parseTimeToSeconds(item.dataset.duration); });
    el.setlistTotalTime.textContent = `Total Time: ${formatSecondsToTime(totalSeconds)}`;
}

async function handlePrintSetlist(drummerMode = false) {
    const setlistId = el.setlistSelector.value;
    if (!setlistId || isDemo) {
        alert("Please select a saved setlist to print.");
        return;
    }

    UI.setStatus(document.getElementById('statusMessage'), 'Generating PDF...');

    try {
        const setlist = await api.getSetlist(setlistId);
        const bandDetails = await api.getBandDetails();
        
        let extraData = { order: [], notes: [] };
        try {
            const parsedNotes = JSON.parse(setlist.notes || '{}');
            if (parsedNotes.order && Array.isArray(parsedNotes.notes)) extraData = parsedNotes;
        } catch (e) { /* ignore */ }
        
        const allItemsMap = new Map();
        (setlist.songs || []).forEach(s => allItemsMap.set(s.id.toString(), { ...s, type: 'song' }));
        (extraData.notes || []).forEach(n => allItemsMap.set(n.id.toString(), n));
        
        const orderedItems = (extraData.order.length > 0 ? extraData.order : (setlist.songs || []).map(s => s.id))
            .map(id => String(id)).map(id => allItemsMap.get(id)).filter(Boolean);

        let printHtml = `<html><head><title>${setlist.name}</title><style>body{font-family:Arial,sans-serif;margin:40px;}.header{text-align:center;margin-bottom:40px;}.setlist-title{font-size:28px;font-weight:bold;}.details{font-size:16px;color:#555;}.song{page-break-inside:avoid;margin-bottom:30px;}.song-title{font-size:20px;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:5px;margin-bottom:10px;}.song-meta{font-style:italic;color:#666;margin-bottom:15px;}.song-content{white-space:pre-wrap;font-family:'Courier New',monospace;line-height:1.6;}.note-item{background-color:#f0f0f0;padding:15px;text-align:center;font-style:italic;margin:20px 0;}.chord{color:#000;font-weight:bold;}</style></head><body><div class="header"><h1 class="setlist-title">${setlist.name}</h1><p class="details">${bandDetails.band_name||''}</p><p class="details">${setlist.venue||''} - ${setlist.event_date?new Date(setlist.event_date).toLocaleDateString():''}</p></div>`;

        orderedItems.forEach((item, index) => {
            if (item.type === 'song') {
                printHtml += `<div class="song"><h2 class="song-title">${index + 1}. ${item.title}</h2><p class="song-meta">Artist: ${item.artist||'Unknown'} | ${getSongKeyInfo(item)}</p><div class="song-content">`;
                const songBlocks = (typeof item.song_blocks === 'string') ? JSON.parse(item.song_blocks || '[]') : (item.song_blocks || []);
                songBlocks.forEach(block => {
                    printHtml += `<strong>${block.label}</strong>\n`;
                    if (block.type === 'lyrics' && block.content) {
                        block.content.split('\n').forEach(line => {
                            let lineToParse = drummerMode ? line.replace(/\[([^\]]+)\]/g, '') : line;
                            const { chordLine, lyricLine } = UI.parseLineForRender(lineToParse);
                            if (chordLine.trim() && !drummerMode) printHtml += `<div class="chord">${chordLine.replace(/<span class="chord-span">/g, '').replace(/<\/span>/g, '')}</div>`;
                            printHtml += `<div>${lyricLine}</div>`;
                        });
                        printHtml += '\n';
                    } else if (block.type === 'tab' && !drummerMode) {
                        // THIS IS THE FIX: Render the tab block
                        printHtml += renderTransposedTabForPDF(block, item) + '\n\n';
                    } else if (block.type === 'drum_tab' && drummerMode) {
                        printHtml += (block.content || '') + '\n\n';
                    }
                });
                printHtml += `</div></div>`;
            } else {
                 printHtml += `<div class="song note-item"><strong>${item.title} (${item.duration || 'N/A'})</strong></div>`;
            }
        });

        printHtml += '</body></html>';

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
        UI.setStatus(document.getElementById('statusMessage'), '');

    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Print failed: ${error.message}`, true);
    }
}

function getSongKeyInfo(song) {
    const SHARP_SCALE = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    const TUNINGS = { E_STANDARD: { name: "E Standard" }, EB_STANDARD: { name: "Eb Standard" }, D_STANDARD: { name: "D Standard" }, DROP_D: { name: "Drop D" }, DROP_C: { name: "Drop C" } };
    
    const transposeChord = (chord, amount) => {
        if (!chord) return '';
        const regex = /^([A-G][b#]?)(.*)/;
        const match = chord.match(regex);
        if (!match) return chord;
        let note = match[1];
        let index = SHARP_SCALE.indexOf(note);
        if (index === -1) {
            const flatNotes = { 'Bb':'A#', 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#'};
            note = flatNotes[note] || note;
            index = SHARP_SCALE.indexOf(note);
        }
        if (index === -1) return chord;
        const newIndex = (index + amount + 12) % 12;
        return SHARP_SCALE[newIndex] + match[2];
    };

    let parts = [];
    const songBlocks = (typeof song.song_blocks === 'string') ? JSON.parse(song.song_blocks || '[]') : (song.song_blocks || []);
    const firstLyricsBlock = songBlocks.find(b => b.type === 'lyrics' && b.content);
    const firstChordMatch = firstLyricsBlock?.content?.match(/\[([^\]]+)\]/);
    
    if (firstChordMatch) {
        const originalKey = firstChordMatch[1];
        const soundingKey = transposeChord(originalKey, (song.transpose || 0) + (song.capo || 0));
        parts.push(`Key: ${soundingKey}`);
    }
    if (song.capo > 0) { parts.push(`Capo ${song.capo}`); }
    if (song.tuning && song.tuning !== 'E_STANDARD') {
        const tuningName = TUNINGS[song.tuning]?.name || song.tuning;
        parts.push(tuningName);
    }
    return parts.join(' | ');
}

function handleStartShow() {
    const setlistId = el.setlistSelector.value;
    if (setlistId) {
        window.open(`/show.html?id=${setlistId}`, '_blank');
    } else {
        alert('Please select a setlist to start the show.');
    }
}
