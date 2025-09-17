// --- START OF FILE public/js/modules/songEditor.js ---

import * as api from '../api.js';
import * as UI from './ui.js';
import * as songDataManager from './songDataManager.js';
import * as fretboardController from './fretboardController.js';
import * as drumEditor from './drumEditor.js';
import * as audioManager from './audioManager.js';
import { parsePastedSong } from './importParser.js';
import { openHistoryModal } from './historyManager.js';
import { updateCurrentSong as updateSetlistSongContext } from './setlistManager.js';
import { getUserPayload } from '../auth.js';

// --- STATE MANAGEMENT ---
let isDemo = false;
let chordQueue = [];
let chordQueueIndex = 0;
let lastFocusedLyricsBlock = null;
let activeResize = {};

// --- DOM ELEMENTS ---
const el = {};

// --- INITIALIZATION ---
export function init(isDemoMode) {
    isDemo = isDemoMode;
    cacheDOMElements();
    attachEventListeners();
    
    fretboardController.init(renderSong); 
    audioManager.init(handleRecordingFinished);

    UI.populateTuningSelector(el.tuningSelector, { E_STANDARD: { name: "E Standard" }, EB_STANDARD: { name: "Eb Standard" }, D_STANDARD: { name: "D Standard" }, DROP_D: { name: "Drop D" }, DROP_C: { name: "Drop C" } });

    loadInitialData();
}

async function loadInitialData() {
    const user = getUserPayload();

    // If we're explicitly on the demo page, force demo mode.
    if (isDemo) {
        songDataManager.replaceSongData(songDataManager.DEMO_SONG_DATA);
        loadChords(null); // Load demo chords
        renderSong();
        if (el.recordBtn) el.recordBtn.disabled = true;
        if (el.saveBtn) el.saveBtn.textContent = "Save Song & Sign Up";
        return;
    }
    
    // For any other page, check for a logged-in user.
    if (user) {
        // Logged-in user flow
        await loadChords(user); // --- PASS USER CONTEXT ---
        UI.setStatus(el.statusMessage, 'Loading songs...');
        try {
            const sheets = await UI.loadSheetList(el.songSelector, api);
            const initialSongId = sheets.length > 0 ? sheets[0].id : 'new';
            await handleLoadSong(initialSongId);
            UI.setStatus(el.statusMessage, '');
        } catch (error) {
            UI.setStatus(el.statusMessage, `Failed to load song list: ${error.message}`, true);
            await handleLoadSong('new');
        }
    } else {
        // Logged-out user on main tool page flow -> show them the demo
        isDemo = true; // Force demo mode for the rest of the session
        songDataManager.replaceSongData(songDataManager.DEMO_SONG_DATA);
        loadChords(null); // Load demo chords
        renderSong();
        if (el.recordBtn) el.recordBtn.disabled = true;
        if (el.saveBtn) el.saveBtn.textContent = "Save Song & Sign Up";
    }
}


function cacheDOMElements() {
    el.titleInput = document.getElementById('titleInput');
    el.artistInput = document.getElementById('artistInput');
    el.durationInput = document.getElementById('durationInput');
    el.songBlocksContainer = document.getElementById('song-blocks-container');
    el.addBlockButtonsContainer = document.getElementById('add-block-buttons');
    el.livePreview = document.getElementById('livePreview');
    el.tuningSelector = document.getElementById('tuningSelector');
    el.capoFretInput = document.getElementById('capoFretInput');
    el.songSelector = document.getElementById('songSelector');
    el.saveBtn = document.getElementById('saveBtn');
    el.deleteBtn = document.getElementById('deleteBtn');
    el.statusMessage = document.getElementById('statusMessage');
    el.chordPalette = document.querySelector('#sidebar #chordPalette');
    el.newChordInput = document.querySelector('#sidebar #newChordInput');
    el.addChordBtn = document.querySelector('#sidebar #addChordBtn');
    el.transposeDownBtn = document.getElementById('transposeDownBtn');
    el.transposeUpBtn = document.getElementById('transposeUpBtn');
    el.transposeStatus = document.getElementById('transposeStatus');
    el.chordQueueDiv = document.getElementById('chordQueue');
    el.clearQueueBtn = document.getElementById('clearQueueBtn');
    el.recordBtn = document.getElementById('recordBtn');
    el.deleteAudioBtn = document.getElementById('deleteAudioBtn');
    el.importBtn = document.getElementById('importBtn');
    el.importModal = document.getElementById('import-modal');
    el.importTextarea = document.getElementById('import-textarea');
    el.importConfirmBtn = document.getElementById('import-confirm-btn');
    el.importCancelBtn = document.getElementById('import-cancel-btn');
    el.resetDemoBtn = document.getElementById('resetDemoBtn');
    el.historyBtn = document.getElementById('historyBtn');
    el.notationPalette = document.getElementById('notation-palette');
}

function attachEventListeners() {
    // Top-level input listeners
    el.titleInput?.addEventListener('input', () => songDataManager.updateSongField('title', el.titleInput.value));
    el.artistInput?.addEventListener('input', () => songDataManager.updateSongField('artist', el.artistInput.value));
    el.durationInput?.addEventListener('input', () => songDataManager.updateSongField('duration', el.durationInput.value));

    // Demo and song selection
    el.resetDemoBtn?.addEventListener('click', () => { if (confirm('Are you sure?')) { songDataManager.replaceSongData(songDataManager.DEMO_SONG_DATA); renderSong(); }});
    el.songSelector?.addEventListener('change', () => handleLoadSong(el.songSelector.value));

    // Musical settings
    [el.tuningSelector, el.capoFretInput].forEach(elem => elem?.addEventListener('input', handleMusicalSettingsChange));
    el.transposeUpBtn?.addEventListener('click', () => handleTranspose(1));
    el.transposeDownBtn?.addEventListener('click', () => handleTranspose(-1));

    // Main buttons
    el.saveBtn?.addEventListener('click', handleSave);
    el.deleteBtn?.addEventListener('click', handleDelete);

    // Chord palette and queue
    el.addChordBtn?.addEventListener('click', handleAddChord);
    el.newChordInput?.addEventListener('keyup', (e) => e.key === 'Enter' && handleAddChord());
    el.clearQueueBtn?.addEventListener('click', () => { chordQueue = []; chordQueueIndex = 0; UI.renderChordQueue(el.chordQueueDiv, el.clearQueueBtn, chordQueue, chordQueueIndex); });

    // Block container interactions
    el.songBlocksContainer?.addEventListener('focusin', (e) => { if (e.target.classList.contains('lyrics-block')) lastFocusedLyricsBlock = e.target; });
    el.songBlocksContainer?.addEventListener('input', (e) => { if (e.target.dataset.field) { const blockId = e.target.closest('.song-block').dataset.blockId; songDataManager.updateBlockData(blockId, 'content', e.target.value, null); renderPreview(); updateSoundingKey(); } });
    el.songBlocksContainer?.addEventListener('click', handleSongBlockClick);
    el.addBlockButtonsContainer?.addEventListener('click', handleAddBlockClick);
    
    // Resize Handle Logic
    el.songBlocksContainer?.addEventListener('mousedown', (e) => { if (e.target.classList.contains('resize-handle')) { e.preventDefault(); const blockEl = e.target.closest('.song-block'); const textarea = blockEl.querySelector('.form-textarea'); if (textarea) { activeResize = { element: textarea, startY: e.clientY, startHeight: textarea.offsetHeight, blockId: blockEl.dataset.blockId }; document.body.style.cursor = 'ns-resize'; } } });
    document.addEventListener('mousemove', (e) => { if (activeResize.element) { const height = activeResize.startHeight + e.clientY - activeResize.startY; activeResize.element.style.height = `${Math.max(50, height)}px`; } });
    document.addEventListener('mouseup', () => { if (activeResize.element) { songDataManager.updateBlockData(activeResize.blockId, null, null, activeResize.element.offsetHeight); activeResize = {}; document.body.style.cursor = ''; } });
    
    // Audio
    el.deleteAudioBtn?.addEventListener('click', handleDeleteAudio);

    // Import
    el.importBtn?.addEventListener('click', () => { el.importTextarea.value = ''; el.importModal.classList.remove('hidden'); });
    el.importCancelBtn?.addEventListener('click', () => el.importModal.classList.add('hidden'));
    el.importConfirmBtn?.addEventListener('click', handleImport);

    // History
    el.historyBtn?.addEventListener('click', () => openHistoryModal(songDataManager.getSongData(), renderPreview, handleLoadSong, renderTransposedTabForHistory));

    // Notation Palette
    setupNotationPalette();
}

/**
 * The main render function for the entire editor. Called whenever state changes.
 */
function renderSong() {
    const songData = songDataManager.getSongData();
    updateUIFromData(songData);
    
    UI.renderSongBlocks(el.songBlocksContainer, songData.song_blocks, UI.createBlockElement, initializeSortable);
    
    // After blocks are rendered, initialize interactive components within them
    songData.song_blocks.forEach(block => {
        if (block.type === 'tab') {
            fretboardController.drawFretboard(block.id);
        } else if (block.type === 'drum_tab') {
            const container = document.getElementById(`drum-editor-${block.id}`);
            if (container) {
                drumEditor.createEditor(container, block.content, (newContent) => {
                    songDataManager.updateBlockData(block.id, 'content', newContent);
                    renderPreview();
                });
            }
        }
    });

    UI.renderAddBlockButtons(el.addBlockButtonsContainer, songData.song_blocks);
    renderPreview();
    updateSoundingKey();
    updateSetlistSongContext(songData);
}

/**
 * Updates all the simple form inputs and UI elements from the songData object.
 * @param {object} songData 
 */
function updateUIFromData(songData) {
    el.titleInput.value = songData.title;
    el.artistInput.value = songData.artist;
    el.durationInput.value = songData.duration || '';

    const audioPlayerContainer = document.getElementById('audioPlayerContainer');
    const audioPlayer = document.getElementById('audioPlayer');
    if (songData.audio_url) {
        audioPlayerContainer.classList.remove('hidden');
        audioPlayer.src = songData.audio_url;
    } else {
        audioPlayerContainer.classList.add('hidden');
        audioPlayer.src = '';
    }

    el.tuningSelector.value = songData.tuning;
    el.capoFretInput.value = songData.capo;
    const steps = songData.transpose;
    el.transposeStatus.textContent = steps > 0 ? `+${steps}` : String(steps);
    el.historyBtn.disabled = !songData.id;
}


// --- EVENT HANDLER FUNCTIONS ---

export async function handleLoadSong(id) {
    if (!id) return;
    UI.setStatus(el.statusMessage, 'Loading song...');
    try {
        await songDataManager.loadSong(id);
        if (el.songSelector.value !== id) {
            el.songSelector.value = id;
        }
        renderSong();
        UI.setStatus(el.statusMessage, 'Song loaded.');
    } catch (error) {
        UI.setStatus(el.statusMessage, `Error loading song: ${error.message}`, true);
        await songDataManager.loadSong('new'); // Load a blank slate on error
        renderSong();
    }
}

async function handleSave() {
    el.saveBtn.disabled = true;
    UI.setStatus(el.statusMessage, 'Saving...');
    try {
        const savedSong = await songDataManager.saveSong(isDemo);
        if (savedSong) { // saveSong returns null in demo mode
            UI.setStatus(el.statusMessage, 'Saved successfully!');
            // If it was a new song, refresh the song list to include it and select it
            if (!el.songSelector.querySelector(`option[value="${savedSong.id}"]`)) {
                await UI.loadSheetList(el.songSelector, api, savedSong.id);
            }
            renderSong(); // Re-render to update things like the history button
        }
    } catch (error) {
        UI.setStatus(el.statusMessage, `Save failed: ${error.message}`, true);
    } finally {
        if (!isDemo) el.saveBtn.disabled = false;
    }
}

async function handleDelete() {
    if (isDemo) { UI.setStatus(el.statusMessage, 'Deleting is disabled in the demo.', true); return; }
    const songData = songDataManager.getSongData();
    if (!songData.id) { UI.setStatus(el.statusMessage, "Cannot delete an unsaved song.", true); return; }

    if (confirm(`Are you sure you want to delete "${songData.title}"?`)) {
        try {
            UI.setStatus(el.statusMessage, 'Deleting...');
            await songDataManager.deleteSong();
            UI.setStatus(el.statusMessage, 'Song deleted.');
            await UI.loadSheetList(el.songSelector, api);
            renderSong(); // Renders the new blank song
        } catch (e) {
            UI.setStatus(el.statusMessage, `Failed to delete: ${e.message}`, true);
        }
    }
}

function handleMusicalSettingsChange() {
    songDataManager.updateSongField('tuning', el.tuningSelector.value);
    songDataManager.updateSongField('capo', parseInt(el.capoFretInput.value, 10) || 0);
    renderSong();
}

function handleTranspose(amount) {
    const songData = songDataManager.getSongData();
    songDataManager.updateSongField('transpose', songData.transpose + amount);
    
    songData.song_blocks.forEach(block => {
        if (block.type === 'lyrics' && block.content) {
            block.content = block.content.replace(/\[([^\]]+)\]/g, (match, chord) => `[${transposeChord(chord, amount)}]`);
        }
    });
    renderSong();
}

function handleAddBlockClick(e) {
    const target = e.target;
    const songData = songDataManager.getSongData();
    const songBlocks = songData.song_blocks;

    if (target.id === 'insert-ref-btn') {
        document.getElementById('ref-dropdown').classList.toggle('hidden');
        return;
    }

    if (target.closest('#ref-dropdown')) {
        const originalId = target.dataset.originalId;
        const originalBlock = songBlocks.find(b => b.id === originalId);
        if(originalBlock) {
            songBlocks.push({ id: `block_${Date.now()}`, type: 'reference', label: `Reference to ${originalBlock.label}`, originalId: originalId });
            renderSong();
        }
        document.getElementById('ref-dropdown').classList.add('hidden');
        return;
    }

    if (target.dataset.action === 'add') {
        const type = target.dataset.type;
        const baseLabel = target.textContent.trim().replace('+', '').trim();
        const count = songBlocks.filter(b => b.label.startsWith(baseLabel)).length + 1;
        const label = `${baseLabel} ${count}`;
        const newBlock = { id: `block_${Date.now()}`, type, label };

        if (type === 'lyrics') { newBlock.content = ''; newBlock.height = 100; }
        if (type === 'tab') { newBlock.data = { notes: [] }; newBlock.strings = 6; newBlock.editMode = false; }
        if (type === 'drum_tab') {
            newBlock.content = drumEditor.DEFAULT_INSTRUMENTS
                .map(i => `${i.shortName.padEnd(2)}|${'-'.repeat(16)}|`)
                .join('\n');
        }
        
        songBlocks.push(newBlock);
        renderSong();
    }
}

function handleSongBlockClick(e) {
    const blockEl = e.target.closest('.song-block');
    if (!blockEl) return;
    const blockId = blockEl.dataset.blockId;
    
    // Chord Queue Placement
    if (e.target.classList.contains('lyrics-block') && chordQueue.length > 0) {
        e.preventDefault();
        const textarea = e.target;
        const chordToPlace = chordQueue[chordQueueIndex];
        const t = `[${chordToPlace}]`;
        const p = textarea.selectionStart;
        textarea.value = textarea.value.slice(0, p) + t + textarea.value.slice(p);
        textarea.focus();
        textarea.setSelectionRange(p + t.length, p + t.length);
        
        chordQueueIndex = (chordQueueIndex + 1) % chordQueue.length;
        songDataManager.updateBlockData(blockId, 'content', textarea.value, null);
        renderPreview();
        UI.renderChordQueue(el.chordQueueDiv, el.clearQueueBtn, chordQueue, chordQueueIndex);
        return;
    }

    // Action Buttons in Header
    const action = e.target.dataset.action;
    if (action) {
        const songData = songDataManager.getSongData();
        const block = songData.song_blocks.find(b => b.id === blockId);

        if (action === 'delete') {
            if (confirm('Are you sure?')) {
                const newBlocks = songData.song_blocks.filter(b => b.id !== blockId && b.originalId !== blockId);
                songDataManager.setSongBlocks(newBlocks);
                renderSong();
            }
        } else if (action === 'rename') {
            const newLabel = prompt('Enter new label:', block.label);
            if (newLabel) {
                block.label = newLabel;
                renderSong();
            }
        } else if (action === 'edit-tab') {
            block.editMode = !block.editMode;
            if (!block.editMode) {
                fretboardController.resetSelection();
            }
            renderSong();
        }
    }
}

function handleImport() {
    const pastedText = el.importTextarea.value;
    if (!pastedText.trim()) {
        alert('Please paste some song text to import.');
        return;
    }
    const result = parsePastedSong(pastedText);
    if (result.blocks.length > 0) {
        const newSongData = {
            ...songDataManager.getSongData(), // keep capo, tuning etc if possible
            id: null,
            title: 'Imported Song',
            artist: '',
            duration: '',
            audio_url: null,
            song_blocks: result.blocks,
            ...result.metadata
        };
        songDataManager.replaceSongData(newSongData);
        el.songSelector.value = 'new';
        renderSong();
        UI.setStatus(el.statusMessage, 'Song imported successfully! Remember to save.');
    } else {
        UI.setStatus(el.statusMessage, 'Could not find any content to import.', true);
    }
    el.importModal.classList.add('hidden');
}

async function handleDeleteAudio() {
    if (confirm('Are you sure you want to permanently delete this voice memo?')) {
        songDataManager.updateSongField('audio_url', null);
        try {
            await handleSave(); // Save the change
            renderSong();
            UI.setStatus(el.statusMessage, 'Recording deleted.', false);
        } catch (error) {
            UI.setStatus(el.statusMessage, `Failed to delete recording: ${error.message}`, true);
        }
    }
}

function handleRecordingFinished(audioUrl) {
    songDataManager.updateSongField('audio_url', audioUrl);
    handleSave(); // Automatically save the song after a successful recording upload
    renderSong();
}


// --- CHORD AND MUSIC THEORY LOGIC ---

async function loadChords(user) {
    try {
        const chords = !user
            ? ['A', 'Am', 'B', 'C', 'Cmaj7', 'D', 'Dm', 'E', 'Em', 'E7', 'F', 'G'].map(name => ({name}))
            : await api.getChords();
        UI.renderChordPalette(el.chordPalette, chords, handleChordClick);
    } catch(e) { 
        if (user) UI.setStatus(el.statusMessage, 'Failed to load chords.', true);
    }
}

async function handleAddChord() {
    if (isDemo) { UI.setStatus(el.statusMessage, 'Cannot save new chords in demo.', true); return; }
    const name = el.newChordInput.value.trim();
    if (!name) return;
    try {
        await api.createChord({ name });
        el.newChordInput.value = '';
        UI.setStatus(el.statusMessage, `'${name}' added.`);
        await loadChords(getUserPayload()); // Reload with user context
    } catch (e) {
        UI.setStatus(el.statusMessage, e.message, true);
    }
}

function handleChordClick(event, name) {
    if (event.ctrlKey || event.metaKey) { 
        chordQueue.push(name); 
        UI.renderChordQueue(el.chordQueueDiv, el.clearQueueBtn, chordQueue, chordQueueIndex); 
    } else if (lastFocusedLyricsBlock) { 
        const t = `[${name}]`; 
        const p = lastFocusedLyricsBlock.selectionStart; 
        lastFocusedLyricsBlock.value = lastFocusedLyricsBlock.value.slice(0, p) + t + lastFocusedLyricsBlock.value.slice(p); 
        lastFocusedLyricsBlock.focus(); 
        lastFocusedLyricsBlock.setSelectionRange(p + t.length, p + t.length); 
        
        const blockId = lastFocusedLyricsBlock.closest('.song-block').dataset.blockId;
        songDataManager.updateBlockData(blockId, 'content', lastFocusedLyricsBlock.value, null);
        renderPreview();
    }
}

function transposeChord(chord, amount) {
    const SHARP_SCALE = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
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
}

function updateSoundingKey() {
    const songData = songDataManager.getSongData();
    const capoFret = songData.capo || 0;
    let firstChord = null;

    for (const block of songData.song_blocks) {
        if (block.type === 'lyrics' && block.content) {
            const match = block.content.match(/\[([^\]]+)\]/);
            if (match) {
                firstChord = match[1];
                break;
            }
        }
    }

    if (!firstChord) {
        document.getElementById('soundingKeyDisplay').textContent = '-';
        return;
    }
    const soundingKey = transposeChord(firstChord, capoFret);
    document.getElementById('soundingKeyDisplay').textContent = soundingKey;
}


// --- UTILITY AND RENDER CALLBACKS ---

function initializeSortable() {
    if (el.songBlocksContainer.sortableInstance) {
        el.songBlocksContainer.sortableInstance.destroy();
    }
    el.songBlocksContainer.sortableInstance = new Sortable(el.songBlocksContainer, {
        animation: 150,
        handle: '.block-header',
        onEnd: (evt) => {
            const songData = songDataManager.getSongData();
            const [movedItem] = songData.song_blocks.splice(evt.oldIndex, 1);
            songData.song_blocks.splice(evt.newIndex, 0, movedItem);
            renderPreview();
        }
    });
}

function setupNotationPalette() {
    el.notationPalette?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const notation = button.dataset.notation;
        const songData = songDataManager.getSongData();
        const selected = fretboardController.getSelectedNote();
        const block = songData.song_blocks.find(b => b.id === selected.blockId);

        if (block && block.data.notes[selected.noteIndex]) {
            const currentNote = block.data.notes[selected.noteIndex];
            currentNote.notation = currentNote.notation === notation ? null : notation;

            if (notation === 'b') {
                const targetFret = prompt("Bend to which fret?", (currentNote.fret - (songData.capo)) + 2);
                if (targetFret !== null && !isNaN(targetFret)) {
                    currentNote.bend_target = parseInt(targetFret, 10);
                }
            } else {
                delete currentNote.bend_target;
            }
            renderSong();
        }
    });
}

function renderPreview() {
    const songData = songDataManager.getSongData();
    UI.renderPreview(el.livePreview, songData.song_blocks, renderTransposedTab);
}

function renderTransposedTab(tabBlock) {
    const songData = songDataManager.getSongData();
    return Fretboard.renderTransposedTab(tabBlock, songData.tuning, songData.capo, songData.transpose);
}

function renderTransposedTabForHistory(tabBlock, historyData) {
     return Fretboard.renderTransposedTab(tabBlock, historyData.tuning, historyData.capo, historyData.transpose);
}
