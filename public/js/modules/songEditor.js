// --- START OF FILE public/js/modules/songEditor.js ---

import * as api from '../api.js';
import * as UI from './ui.js';
import * as Fretboard from './fretboard.js';
import { openHistoryModal } from './historyManager.js';

// --- STATE MANAGEMENT ---
let isDemo = false;
let songData = {};
let chordQueue = [];
let chordQueueIndex = 0;
let lastFocusedLyricsBlock = null;
let mediaRecorder = null;
let audioChunks = [];
let fretSelectionContext = {};
let selectedNote = {};
let activeResize = {};
let isDraggingNote = false;

// --- CONSTANTS ---
const CONSTANTS = {
    CLOUDINARY_CLOUD_NAME: "dawbku2eq",
    CLOUDINARY_UPLOAD_PRESET: "project-anthem-unsigned",
    TUNINGS: { E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, DROP_C: { name: "Drop C", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'C'] } },
    STRING_CONFIG: { 6: { height: 180, stringSpacing: 28 }, 7: { height: 210, stringSpacing: 28 }, 8: { height: 240, stringSpacing: 28 } },
    FRETBOARD_CONFIG: { frets: 24, width: 8000, nutWidth: 15, fretSpacing: 80, dotFrets: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24], dotRadius: 5, noteRadius: 11 },
    SHARP_SCALE: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
};

// --- DOM ELEMENTS ---
const el = {};

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
    el.stopBtn = document.getElementById('stopBtn');
    el.recordingStatus = document.getElementById('recordingStatus');
    el.deleteAudioBtn = document.getElementById('deleteAudioBtn');
    el.fretSelectionModal = document.getElementById('fret-selection-modal');
    el.fretNumberSelector = document.getElementById('fret-number-selector');
    el.addFretBtn = document.getElementById('add-fret-btn');
    el.cancelFretBtn = document.getElementById('cancel-fret-btn');
    el.soundingKeyDisplay = document.getElementById('soundingKeyDisplay');
    el.importBtn = document.getElementById('importBtn');
    el.importModal = document.getElementById('import-modal');
    el.importTextarea = document.getElementById('import-textarea');
    el.importConfirmBtn = document.getElementById('import-confirm-btn');
    el.importCancelBtn = document.getElementById('import-cancel-btn');
    el.resetDemoBtn = document.getElementById('resetDemoBtn');
    el.historyBtn = document.getElementById('historyBtn');
}


// --- INITIALIZATION ---
export function init(isDemoMode) {
    isDemo = isDemoMode;
    cacheDOMElements();
    attachEventListeners();
    UI.populateTuningSelector(el.tuningSelector, CONSTANTS.TUNINGS);

    if (isDemo) {
        loadDemoChords();
        initializeDemoSong();
        if (el.recordBtn) el.recordBtn.disabled = true;
    } else {
        loadChords();
        UI.loadSheetList(el.songSelector, api).then(() => initializeNewSong(false));
    }
}

function attachEventListeners() {
    el.resetDemoBtn?.addEventListener('click', () => { if (confirm('Are you sure?')) initializeDemoSong(); });
    [el.tuningSelector, el.capoFretInput].forEach(elem => elem?.addEventListener('input', () => { songData.tuning = el.tuningSelector.value; songData.capo = parseInt(el.capoFretInput.value, 10) || 0; renderSongBlocks(); updateSoundingKey(); }));
    el.transposeUpBtn?.addEventListener('click', () => handleTranspose(1));
    el.transposeDownBtn?.addEventListener('click', () => handleTranspose(-1));
    el.saveBtn?.addEventListener('click', handleSave);
    el.deleteBtn?.addEventListener('click', handleDelete);
    el.addChordBtn?.addEventListener('click', handleAddChord);
    el.newChordInput?.addEventListener('keyup', (e) => e.key === 'Enter' && handleAddChord());
    el.clearQueueBtn?.addEventListener('click', () => { chordQueue = []; chordQueueIndex = 0; UI.renderChordQueue(el.chordQueueDiv, el.clearQueueBtn, chordQueue, chordQueueIndex); });
    el.songBlocksContainer?.addEventListener('focusin', (e) => { if (e.target.classList.contains('lyrics-block')) lastFocusedLyricsBlock = e.target; });
    el.songBlocksContainer?.addEventListener('input', (e) => { if (e.target.dataset.field) { const blockId = e.target.closest('.song-block').dataset.blockId; updateBlockData(blockId, 'content', e.target.value); updateSoundingKey(); } });
    el.songBlocksContainer?.addEventListener('mousedown', (e) => { if (e.target.classList.contains('resize-handle')) { e.preventDefault(); const blockEl = e.target.closest('.song-block'); const textarea = blockEl.querySelector('.form-textarea'); if (textarea) { activeResize = { element: textarea, startY: e.clientY, startHeight: textarea.offsetHeight, blockId: blockEl.dataset.blockId }; document.body.style.cursor = 'ns-resize'; } } });
    document.addEventListener('mousemove', (e) => { if (activeResize.element) { const height = activeResize.startHeight + e.clientY - activeResize.startY; activeResize.element.style.height = `${Math.max(50, height)}px`; } if (isDraggingNote && selectedNote.blockId) { const block = songData.song_blocks.find(b => b.id === selectedNote.blockId); const note = block?.data?.notes[selectedNote.noteIndex]; if (note) { const svg = document.getElementById(`fretboard-svg-${selectedNote.blockId}`); const clickData = Fretboard.getFretFromClick(e, svg, block.strings, CONSTANTS.STRING_CONFIG, CONSTANTS.FRETBOARD_CONFIG); if (clickData) { note.position = clickData.position; note.string = clickData.string; drawNotesOnFretboard(selectedNote.blockId); } } } });
    document.addEventListener('mouseup', () => { if (activeResize.element) { const newHeight = activeResize.element.offsetHeight; updateBlockData(activeResize.blockId, null, null, newHeight); activeResize = { element: null, startY: 0, startHeight: 0 }; document.body.style.cursor = ''; } if(isDraggingNote) { isDraggingNote = false; renderPreview(); } });
    el.songBlocksContainer?.addEventListener('change', (e) => { if (e.target.dataset.action === 'change-strings') { const blockId = e.target.closest('.song-block').dataset.blockId; const block = songData.song_blocks.find(b => b.id === blockId); if (block) { block.strings = parseInt(e.target.value, 10); drawFretboard(blockId); } } });
    el.songBlocksContainer?.addEventListener('click', handleSongBlockClick);
    document.addEventListener('keydown', handleDeleteNote);
    el.addBlockButtonsContainer?.addEventListener('click', handleAddBlockClick);
    el.recordBtn?.addEventListener('click', startRecording);
    el.stopBtn?.addEventListener('click', stopRecording);
    el.songSelector?.addEventListener('change', () => loadSong(el.songSelector.value));
    el.addFretBtn?.addEventListener('click', confirmFretSelection);
    el.cancelFretBtn?.addEventListener('click', () => el.fretSelectionModal.classList.add('hidden'));
    el.deleteAudioBtn?.addEventListener('click', handleDeleteAudio);
    el.importBtn?.addEventListener('click', () => { el.importTextarea.value = ''; el.importModal.classList.remove('hidden'); });
    el.importCancelBtn?.addEventListener('click', () => el.importModal.classList.add('hidden'));
    el.importConfirmBtn?.addEventListener('click', handleImport);
    el.historyBtn?.addEventListener('click', () => openHistoryModal(songData, renderPreview, (id) => loadSong(id), renderTransposedTabForHistory));
}

// Public function to allow history module to reload a song after restore
export function reloadSong(id) {
    loadSong(id);
}


// --- CORE SONG LOGIC ---

function initializeDemoSong() {
    songData = { 
        id: 'demo-song', title: 'The ProAnthem Feature Tour', artist: 'The Dev Team', audio_url: null, duration: '4:15',
        song_blocks: [
            { id: 'block_1', type: 'lyrics', label: 'Lyrics & Chords', content: '[G]Just type your lyrics [D]in this space,\nPut [Em]chords in brackets, [C]right in place.\nThe [G]preview updates, [D]as you go,\nA [C]perfect layout for your [G]show.', height: 140 },
            { id: 'block_2', type: 'tab', label: 'Guitar Riff Example', strings: 6, data: { notes: [{string: 3, fret: 5, position: 200}, {string: 3, fret: 7, position: 350}, {string: 2, fret: 5, position: 500}, {string: 2, fret: 7, position: 650}]}, editMode: false }
        ],
        tuning: 'E_STANDARD', capo: 0, transpose: 0
    };
    el.titleInput.value = songData.title;
    el.artistInput.value = songData.artist;
    el.durationInput.value = songData.duration;
    updateMusicalSettingsUI();
    renderSongBlocks();
    updateSoundingKey();
    UI.setStatus(el.statusMessage, 'Demo loaded. Your changes will not be saved.');
}

async function initializeNewSong(forceNew = false) {
    el.historyBtn.disabled = true;
    const createBlankSong = () => {
        songData = { id: null, title: '', artist: '', duration: '', audio_url: null, song_blocks: [{ id: `block_${Date.now()}`, type: 'lyrics', label: 'Verse 1', content: '', height: 100 }], tuning: 'E_STANDARD', capo: 0, transpose: 0 };
        el.titleInput.value = '';
        el.artistInput.value = '';
        el.durationInput.value = '';
        if (el.songSelector) el.songSelector.value = 'new';
        document.getElementById('audioPlayerContainer')?.classList.add('hidden');
        document.getElementById('audioPlayer')?.setAttribute('src', '');
        updateMusicalSettingsUI();
        renderSongBlocks();
        updateSoundingKey();
    };

    if (forceNew) { createBlankSong(); return; }
    try {
        const songs = await api.getSheets();
        if (songs && songs.length > 0) {
            await loadSong(songs[0].id);
            if (el.songSelector) el.songSelector.value = songs[0].id;
        } else {
            createBlankSong();
        }
    } catch (e) {
        createBlankSong();
        UI.setStatus(el.statusMessage, 'Could not load songs. Starting new.', true);
    }
}

async function loadSong(id) {
    if (!id || id === 'new') {
        initializeNewSong(true);
        return;
    }
    UI.setStatus(el.statusMessage, 'Loading song...');
    try {
        const data = await api.getSheet(id);
        songData = { id: data.id, title: data.title || '', artist: data.artist || '', duration: data.duration, audio_url: data.audio_url, song_blocks: Array.isArray(data.song_blocks) ? data.song_blocks : [], tuning: data.tuning ?? 'E_STANDARD', capo: data.capo ?? 0, transpose: data.transpose ?? 0 };
        el.titleInput.value = songData.title;
        el.artistInput.value = songData.artist;
        el.durationInput.value = songData.duration || '';
        const audioPlayerContainer = document.getElementById('audioPlayerContainer');
        const audioPlayer = document.getElementById('audioPlayer');
        if (songData.audio_url) { audioPlayerContainer.classList.remove('hidden'); audioPlayer.src = songData.audio_url; } else { audioPlayerContainer.classList.add('hidden'); audioPlayer.src = ''; }
        updateMusicalSettingsUI();
        renderSongBlocks();
        UI.setStatus(el.statusMessage, 'Song loaded.');
        updateSoundingKey();
        el.historyBtn.disabled = false;
    } catch (error) {
        UI.setStatus(el.statusMessage, `Error loading song: ${error.message}`, true);
        initializeNewSong(true);
    }
}

async function handleSave() {
    if (isDemo) {
        songData.title = el.titleInput.value || 'My Demo Song';
        songData.artist = el.artistInput.value || 'An Artist';
        songData.duration = el.durationInput.value || null;
        const hasContent = songData.song_blocks.some(b => (b.content && b.content.trim() !== '') || (b.data && b.data.notes && b.data.notes.length > 0));
        if (!hasContent && !songData.title) {
            alert("Please add a title or some content before saving!");
            return;
        }
        alert("Let's save your work! We'll take you to the signup page. Your song will be waiting for you in your new account.");
        localStorage.setItem('pendingSong', JSON.stringify(songData));
        window.location.href = '/pricing.html';
        return;
    }

    el.saveBtn.disabled = true;
    UI.setStatus(el.statusMessage, 'Saving...');
    try {
        songData.title = el.titleInput.value || 'Untitled';
        songData.artist = el.artistInput.value || 'Unknown Artist';
        songData.duration = el.durationInput.value || null;
        const savedSong = songData.id ? await api.updateSheet(songData.id, songData) : await api.createSheet(songData);
        songData.id = savedSong.id;
        UI.setStatus(el.statusMessage, 'Saved successfully!');
        if (!el.songSelector.querySelector(`option[value="${savedSong.id}"]`)) {
            await UI.loadSheetList(el.songSelector, api, savedSong.id);
        } else {
            el.songSelector.querySelector(`option[value="${savedSong.id}"]`).textContent = songData.title;
            el.songSelector.value = savedSong.id;
        }
        el.historyBtn.disabled = false;
    } catch (error) {
        UI.setStatus(el.statusMessage, `Save failed: ${error.message}`, true);
    } finally {
        el.saveBtn.disabled = false;
    }
}

async function handleDelete() {
    if (isDemo) { UI.setStatus(el.statusMessage, 'Deleting is disabled in the demo.', true); return; }
    if (!songData.id) { UI.setStatus(el.statusMessage, "Cannot delete an unsaved song.", true); return; }
    if (confirm(`Are you sure you want to delete "${songData.title}"?`)) {
        try {
            UI.setStatus(el.statusMessage, 'Deleting...');
            await api.deleteSheet(songData.id);
            UI.setStatus(el.statusMessage, 'Song deleted.');
            await UI.loadSheetList(el.songSelector, api);
            await initializeNewSong();
        } catch (e) {
            UI.setStatus(el.statusMessage, `Failed to delete: ${e.message}`, true);
        }
    }
}


// --- RENDERING & UI LOGIC ---

function renderSongBlocks() {
    UI.renderSongBlocks(el.songBlocksContainer, songData.song_blocks, (block) => UI.createBlockElement(block, drawFretboard), initializeSortable);
    UI.renderAddBlockButtons(el.addBlockButtonsContainer, songData.song_blocks);
    renderPreview();
}

function renderPreview() {
    UI.renderPreview(el.livePreview, songData.song_blocks, (block) => renderTransposedTab(block));
}

function updateMusicalSettingsUI() {
    if (el.tuningSelector) el.tuningSelector.value = songData.tuning;
    if (el.capoFretInput) el.capoFretInput.value = songData.capo;
    if (el.transposeStatus) {
        const steps = songData.transpose;
        el.transposeStatus.textContent = steps > 0 ? `+${steps}` : steps;
    }
}


// --- CHORD & PALETTE LOGIC ---

async function loadChords() {
    try {
        const chords = await api.getChords();
        UI.renderChordPalette(el.chordPalette, chords, handleChordClick);
    } catch(e) { UI.setStatus(el.statusMessage, 'Failed to load chords.', true); }
}

function loadDemoChords() {
    const demoChords = ['A', 'Am', 'B', 'C', 'Cmaj7', 'D', 'Dm', 'E', 'Em', 'E7', 'F', 'G'].map(name => ({name}));
    UI.renderChordPalette(el.chordPalette, demoChords, handleChordClick);
}

async function handleAddChord() {
    if (isDemo) { UI.setStatus(el.statusMessage, 'Cannot save new chords in demo.', true); return; }
    const name = el.newChordInput.value.trim();
    if (!name) return;
    try {
        await api.createChord({ name });
        el.newChordInput.value = '';
        UI.setStatus(el.statusMessage, `'${name}' added.`);
        await loadChords();
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
        updateBlockData(lastFocusedLyricsBlock.closest('.song-block').dataset.blockId, 'content', lastFocusedLyricsBlock.value); 
    }
}


// --- EVENT HANDLERS & HELPERS ---

function updateBlockData(blockId, field, value, height) {
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (block) {
        if (field !== null) block[field] = value;
        if (height !== null) block.height = height;
        if (field === 'content') renderPreview();
    }
}

function handleTranspose(amount) {
    songData.transpose += amount;
    updateMusicalSettingsUI();
    songData.song_blocks.forEach(block => {
        if (block.type === 'lyrics' && block.content) {
            block.content = block.content.replace(/\[([^\]]+)\]/g, (match, chord) => `[${transposeChord(chord, amount)}]`);
        }
    });
    renderSongBlocks();
}

function transposeChord(chord, amount) {
    const regex = /^([A-G][b#]?)(.*)/;
    const match = chord.match(regex);
    if (!match) return chord;
    let note = match[1];
    let index = CONSTANTS.SHARP_SCALE.indexOf(note);
    if (index === -1) {
        const flatNotes = { 'Bb':'A#', 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#'};
        note = flatNotes[note] || note;
        index = CONSTANTS.SHARP_SCALE.indexOf(note);
    }
    if (index === -1) return chord;
    const newIndex = (index + amount + 12) % 12;
    return CONSTANTS.SHARP_SCALE[newIndex] + match[2];
}

function updateSoundingKey() {
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
        el.soundingKeyDisplay.textContent = '-';
        return;
    }
    const soundingKey = transposeChord(firstChord, capoFret);
    el.soundingKeyDisplay.textContent = soundingKey;
}

function initializeSortable() {
    if (el.songBlocksContainer.sortableInstance) {
        el.songBlocksContainer.sortableInstance.destroy();
    }
    el.songBlocksContainer.sortableInstance = new Sortable(el.songBlocksContainer, {
        animation: 150,
        handle: '.block-header',
        onEnd: (evt) => {
            const [movedItem] = songData.song_blocks.splice(evt.oldIndex, 1);
            songData.song_blocks.splice(evt.newIndex, 0, movedItem);
            renderPreview();
        }
    });
}

function handleSongBlockClick(e) {
    const blockEl = e.target.closest('.song-block');
    if (!blockEl) return;
    const blockId = blockEl.dataset.blockId;
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (e.target.classList.contains('lyrics-block') && chordQueue.length > 0) {
        e.preventDefault();
        const textarea = e.target;
        const chordToPlace = chordQueue[chordQueueIndex];
        const t = `[${chordToPlace}]`;
        const p = textarea.selectionStart;
        textarea.value = textarea.value.slice(0, p) + t + textarea.value.slice(p);
        textarea.focus();
        const newPos = p + t.length;
        textarea.setSelectionRange(newPos, newPos);
        chordQueueIndex = (chordQueueIndex + 1) % chordQueue.length;
        updateBlockData(blockId, 'content', textarea.value);
        UI.renderChordQueue(el.chordQueueDiv, el.clearQueueBtn, chordQueue, chordQueueIndex);
    } else if (e.target.dataset.action === 'delete') {
        if (confirm('Are you sure?')) {
            songData.song_blocks = songData.song_blocks.filter(b => b.id !== blockId && b.originalId !== blockId);
            renderSongBlocks();
        }
    } else if (e.target.dataset.action === 'rename') {
        const newLabel = prompt('Enter new label:', block.label);
        if (newLabel) {
            block.label = newLabel;
            renderSongBlocks();
        }
    } else if (e.target.dataset.action === 'edit-tab') {
        const button = e.target;
        block.editMode = !block.editMode;
        button.textContent = block.editMode ? 'Done Editing' : 'Edit';
        button.classList.toggle('btn-secondary');
        button.classList.toggle('btn-edit-mode');
        if (!block.editMode && selectedNote.blockId === blockId) {
            selectedNote = {};
            drawNotesOnFretboard(blockId);
        }
    }
}

function handleAddBlockClick(e) {
    const target = e.target;
    if (target.id === 'insert-ref-btn') {
        document.getElementById('ref-dropdown').classList.toggle('hidden');
    } else if (target.closest('#ref-dropdown')) {
        const originalId = target.dataset.originalId;
        const originalBlock = songData.song_blocks.find(b => b.id === originalId);
        if(originalBlock) {
            songData.song_blocks.push({ id: `block_${Date.now()}`, type: 'reference', label: `Reference to ${originalBlock.label}`, originalId: originalId });
            renderSongBlocks();
        }
        document.getElementById('ref-dropdown').classList.add('hidden');
    } else if (target.dataset.action === 'add') {
        const type = target.dataset.type;
        const baseLabel = target.textContent.trim().replace('+', '').trim();
        const count = songData.song_blocks.filter(b => b.label.startsWith(baseLabel)).length + 1;
        const label = `${baseLabel} ${count}`;
        const newBlock = { id: `block_${Date.now()}`, type, label, height: 100 };
        if (type === 'lyrics' || type === 'drum_tab') newBlock.content = '';
        if (type === 'tab') {
            newBlock.data = { notes: [] };
            newBlock.strings = 6;
            newBlock.editMode = false;
        }
        songData.song_blocks.push(newBlock);
        renderSongBlocks();
    }
}

function handleDeleteNote(e) {
    if (!selectedNote.blockId || selectedNote.noteIndex === undefined) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
        if (block?.data?.notes?.[selectedNote.noteIndex]) {
            block.data.notes.splice(selectedNote.noteIndex, 1);
            const oldBlockId = selectedNote.blockId;
            selectedNote = {};
            drawNotesOnFretboard(oldBlockId);
            renderPreview();
        }
    }
}

function confirmFretSelection() {
    const { blockId, string, position } = fretSelectionContext;
    const fret = parseInt(el.fretNumberSelector.value, 10);
    const block = songData.song_blocks.find(b => b.id === blockId);
    if(block && string !== null && position !== null && fret >= 0) {
        const totalOffset = (CONSTANTS.TUNINGS[songData.tuning]?.offset ?? 0) + songData.capo;
        if (!block.data) block.data = { notes: [] };
        block.data.notes.push({ string, fret: fret + totalOffset, position });
        drawNotesOnFretboard(blockId);
        renderPreview();
    }
    el.fretSelectionModal.classList.add('hidden');
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = handleSaveRecording;
        audioChunks = [];
        mediaRecorder.start();
        el.recordBtn.textContent = 'Recording...';
        el.recordBtn.disabled = true;
        el.stopBtn.disabled = false;
        el.recordingStatus.textContent = 'Recording...';
    } catch (err) {
        UI.setStatus(el.statusMessage, 'Microphone access denied.', true);
    }
}

function stopRecording() {
    if (mediaRecorder) mediaRecorder.stop();
    el.recordBtn.textContent = 'Record';
    el.recordBtn.disabled = false;
    el.stopBtn.disabled = true;
    el.recordingStatus.textContent = 'Processing...';
}

async function handleSaveRecording() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', CONSTANTS.CLOUDINARY_UPLOAD_PRESET);
    const url = `https://api.cloudinary.com/v1_1/${CONSTANTS.CLOUDINARY_CLOUD_NAME}/video/upload`;
    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        songData.audio_url = data.secure_url;
        await handleSave();
        el.recordingStatus.textContent = 'Recording saved.';
        document.getElementById('audioPlayerContainer').classList.remove('hidden');
        document.getElementById('audioPlayer').src = data.secure_url;
    } catch (error) {
        UI.setStatus(el.statusMessage, 'Failed to upload recording.', true);
        el.recordingStatus.textContent = '';
    }
}

async function handleDeleteAudio() {
    if (confirm('Are you sure you want to permanently delete this voice memo?')) {
        songData.audio_url = null;
        try {
            await handleSave();
            document.getElementById('audioPlayerContainer').classList.add('hidden');
            document.getElementById('audioPlayer').src = '';
            UI.setStatus(el.statusMessage, 'Recording deleted.', false);
        } catch (error) {
            UI.setStatus(el.statusMessage, `Failed to delete recording: ${error.message}`, true);
        }
    }
}

function renderTransposedTab(tabBlock) {
    return Fretboard.renderTransposedTab(tabBlock, songData.tuning, songData.capo, songData.transpose, CONSTANTS.TUNINGS, CONSTANTS.FRETBOARD_CONFIG);
}

function renderTransposedTabForHistory(tabBlock, historyData) {
     return Fretboard.renderTransposedTab(tabBlock, historyData.tuning, historyData.capo, historyData.transpose, CONSTANTS.TUNINGS, CONSTANTS.FRETBOARD_CONFIG);
}

function handleImport() {
    const pastedText = el.importTextarea.value;
    if (!pastedText.trim()) {
        alert('Please paste some song text to import.');
        return;
    }
    const result = parsePastedSong(pastedText);
    if (result.blocks.length > 0) {
        songData = {
            id: null,
            title: 'Imported Song',
            artist: '',
            duration: '',
            audio_url: null,
            song_blocks: result.blocks,
            tuning: result.metadata.tuning,
            capo: result.metadata.capo,
            transpose: 0
        };
        el.titleInput.value = songData.title;
        el.artistInput.value = songData.artist;
        el.durationInput.value = '';
        if (el.songSelector) el.songSelector.value = 'new';
        updateMusicalSettingsUI();
        renderSongBlocks();
        updateSoundingKey();
        UI.setStatus(el.statusMessage, 'Song imported successfully! Remember to save.');
    } else {
        UI.setStatus(el.statusMessage, 'Could not find any content to import.', true);
    }
    el.importModal.classList.add('hidden');
}

function parsePastedSong(text) {
    let metadata = { capo: 0, tuning: 'E_STANDARD' };
    let lines = text.split('\n').map(l => l.replace(/\r/g, ''));
    lines = lines.filter(line => {
        const capoMatch = line.match(/capo\s*:?\s*(\d+)/i);
        if (capoMatch) { metadata.capo = parseInt(capoMatch[1], 10); return false; }
        if (line.match(/tuning/i)) {
            const l = line.toLowerCase();
            if (l.includes('eb') || l.includes('e flat')) metadata.tuning = 'EB_STANDARD';
            else if (l.includes('drop d')) metadata.tuning = 'DROP_D';
            else if (l.includes('d standard')) metadata.tuning = 'D_STANDARD';
            else if (l.includes('drop c')) metadata.tuning = 'DROP_C';
            return false;
        }
        return !line.match(/^Page \d+\/\d+$/i) && !line.match(/ultimate-guitar\.com/i);
    });
    const newBlocks = []; let currentBlock = null;
    const headerRegex = /^\s*(?:\[([^\]]+)\]|(intro|verse|chorus|bridge|pre-chorus|prechorus|solo|outro|tag|instrumental)[\s\d:]*)\s*$/i;
    const tabLineRegex = /\|.*-|-.*\|/;
    const chordRegexSource = `[A-G][b#]?(?:m|maj|sus|dim|add|aug|m7|7|maj7|m7b5|6|9|11|13)*(?:\\/[A-G][b#]?)?`;
    const chordLineRegex = new RegExp(`^\\s*(${chordRegexSource}(\\s+${chordRegexSource})*\\s*)$`);
    const pushBlock = () => { if (currentBlock) { currentBlock.content = currentBlock.content.trim(); if (currentBlock.content) newBlocks.push(currentBlock); } };
    const createNewBlock = (label, type) => { pushBlock(); const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase().replace('prechorus', 'Pre-Chorus'); currentBlock = { id: `block_${Date.now()}_${newBlocks.length}`, label: capitalizedLabel || 'Section', type: type, content: '', height: 120 }; };
    function bracketInlineChords(line) { if (line.includes('[') || line.trim() === '') return line; const chordTokenRegex = new RegExp(`\\b(${chordRegexSource})\\b`, 'g'); return line.replace(chordTokenRegex, '[$1]'); }
    function mergeChordLyricLines(chordLine, lyricLine) { let chords = []; const chordFinderRegex = new RegExp(`\\b(${chordRegexSource})\\b`, 'g'); let match; while ((match = chordFinderRegex.exec(chordLine)) !== null) { chords.push({ text: `[${match[0]}]`, index: match.index }); } if (chords.length === 0) return lyricLine; let mergedLine = lyricLine; for (let i = chords.length - 1; i >= 0; i--) { const chord = chords[i]; const insertionIndex = Math.min(chord.index, mergedLine.length); mergedLine = mergedLine.slice(0, insertionIndex) + chord.text + mergedLine.slice(insertionIndex); } return mergedLine; }
    let sectionLines = [];
    const processSectionLines = (blockLines) => { if (!currentBlock) createNewBlock('Verse 1', 'lyrics'); if (blockLines.every(l => l.trim() === '')) return; if (blockLines.some(l => tabLineRegex.test(l))) { currentBlock.type = 'tab'; currentBlock.content += blockLines.join('\n') + '\n\n'; return; } let processedLines = []; for (let i = 0; i < blockLines.length; i++) { const currentLine = blockLines[i]; const nextLine = (i + 1 < blockLines.length) ? blockLines[i + 1] : null; if (chordLineRegex.test(currentLine.trim()) && nextLine && nextLine.trim().length > 0 && !chordLineRegex.test(nextLine.trim())) { processedLines.push(mergeChordLyricLines(currentLine, nextLine)); i++; } else { processedLines.push(bracketInlineChords(currentLine)); } } currentBlock.content += processedLines.join('\n') + '\n\n'; };
    for (const line of lines) { const headerMatch = line.match(headerRegex); if (headerMatch) { if (sectionLines.length > 0) processSectionLines(sectionLines); sectionLines = []; const label = (headerMatch[1] || headerMatch[2] || 'Section').trim(); createNewBlock(label, 'lyrics'); } else { sectionLines.push(line); } }
    if (sectionLines.length > 0) processSectionLines(sectionLines);
    pushBlock();
    return { blocks: newBlocks, metadata: metadata };
}
