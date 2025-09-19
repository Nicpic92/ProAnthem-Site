// --- START OF FILE public/js/modules/songEditor.js ---

import * as api from '/js/api.js';
import * as UI from './ui.js';
import * as songDataManager from './songDataManager.js';
import * as fretboardController from './fretboardController.js';
import * as drumEditor from './drumEditor.js';
import * as audioManager from './audioManager.js';
import { parsePastedSong } from './importParser.js';
import { openHistoryModal } from './historyManager.js';
import { updateCurrentSong as updateSetlistSongContext } from './setlistManager.js';
import { getUserPayload } from '/js/auth.js';
import * as diagramRenderer from './diagramRenderer.js';
import { getChordDiagrams } from '/js/api.js';
import * as stemManager from './stemManager.js';

// --- STATE MANAGEMENT ---
let isDemo = false;
let userPermissions = {}; // Store user permissions here
let chordQueue = [];
let chordQueueIndex = 0;
let lastFocusedLyricsBlock = null;
let activeResize = {};

// --- DOM ELEMENTS ---
const el = {};

// --- INITIALIZATION ---
export function init(isDemoMode) {
    isDemo = isDemoMode;
    const user = getUserPayload();
    userPermissions = user ? user.permissions : {}; // Get permissions from JWT

    cacheDOMElements();
    attachEventListeners();
    
    fretboardController.init(renderSong); 
    audioManager.init(handleRecordingFinished);
    stemManager.init();

    UI.populateTuningSelector(el.tuningSelector, { E_STANDARD: { name: "E Standard" }, EB_STANDARD: { name: "Eb Standard" }, D_STANDARD: { name: "D Standard" }, DROP_D: { name: "Drop D" }, DROP_C: { name: "Drop C" } });

    loadInitialData();
}

async function loadInitialData() {
    if (isDemo) {
        setupDemoMode();
        return;
    }
    
    if (userPermissions.role) { // Check if permissions were loaded
        try {
            await loadChords(true); // Assuming logged in
            UI.setStatus(el.statusMessage, 'Loading songs...');
            const sheets = await UI.loadSheetList(el.songSelector, api);
            const initialSongId = sheets.length > 0 ? sheets[0].id : 'new';
            await handleLoadSong(initialSongId);
            UI.setStatus(el.statusMessage, '');
        } catch (error) {
            console.error("Authentication error during data load.", error);
            if (!error.message.includes("Session expired")) {
                UI.setStatus(el.statusMessage, `Error: ${error.message}. Loading demo.`, true);
                setupDemoMode();
            }
        }
    } else {
        setupDemoMode();
    }
}

function setupDemoMode() {
    isDemo = true;
    userPermissions = { can_use_stems: false, can_use_setlists: true, song_limit: 3 }; // Simulate some permissions
    songDataManager.replaceSongData(songDataManager.DEMO_SONG_DATA);
    loadChords(false);
    renderSong();
    if (el.saveBtn) el.saveBtn.textContent = "Save Song & Sign Up";
    UI.setStatus(el.statusMessage, "This is a demo. Your work will not be saved.");
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
    el.manageStemsBtn = document.getElementById('manage-stems-btn');
    el.printPdfBtn = document.getElementById('printPdfBtn'); // Get the new print button
}

function attachEventListeners() {
    // Input event listeners remain the same...
    el.titleInput?.addEventListener('input', () => songDataManager.updateSongField('title', el.titleInput.value));
    el.artistInput?.addEventListener('input', () => songDataManager.updateSongField('artist', el.artistInput.value));
    el.durationInput?.addEventListener('input', () => songDataManager.updateSongField('duration', el.durationInput.value));

    el.resetDemoBtn?.addEventListener('click', () => { if (confirm('Are you sure?')) { setupDemoMode(); }});
    el.songSelector?.addEventListener('change', () => handleLoadSong(el.songSelector.value));

    [el.tuningSelector, el.capoFretInput].forEach(elem => elem?.addEventListener('input', handleMusicalSettingsChange));
    el.transposeUpBtn?.addEventListener('click', () => handleTranspose(1));
    el.transposeDownBtn?.addEventListener('click', () => handleTranspose(-1));

    el.saveBtn?.addEventListener('click', handleSave);
    el.deleteBtn?.addEventListener('click', handleDelete);

    el.addChordBtn?.addEventListener('click', handleAddChord);
    el.newChordInput?.addEventListener('keyup', (e) => e.key === 'Enter' && handleAddChord());
    el.clearQueueBtn?.addEventListener('click', () => { chordQueue = []; chordQueueIndex = 0; UI.renderChordQueue(el.chordQueueDiv, el.clearQueueBtn, chordQueue, chordQueueIndex); });

    el.songBlocksContainer?.addEventListener('focusin', (e) => { if (e.target.classList.contains('lyrics-block')) lastFocusedLyricsBlock = e.target; });
    el.songBlocksContainer?.addEventListener('input', (e) => { if (e.target.dataset.field) { const blockId = e.target.closest('.song-block').dataset.blockId; songDataManager.updateBlockData(blockId, 'content', e.target.value, null); renderPreview(); updateSoundingKey(); } });
    el.songBlocksContainer?.addEventListener('click', handleSongBlockClick);
    el.addBlockButtonsContainer?.addEventListener('click', handleAddBlockClick);
    
    // Resize handlers remain the same...
    el.songBlocksContainer?.addEventListener('mousedown', (e) => { if (e.target.classList.contains('resize-handle')) { e.preventDefault(); const blockEl = e.target.closest('.song-block'); const textarea = blockEl.querySelector('.form-textarea'); if (textarea) { activeResize = { element: textarea, startY: e.clientY, startHeight: textarea.offsetHeight, blockId: blockEl.dataset.blockId }; document.body.style.cursor = 'ns-resize'; } } });
    document.addEventListener('mousemove', (e) => { if (activeResize.element) { const height = activeResize.startHeight + e.clientY - activeResize.startY; activeResize.element.style.height = `${Math.max(50, height)}px`; } });
    document.addEventListener('mouseup', () => { if (activeResize.element) { songDataManager.updateBlockData(activeResize.blockId, null, null, activeResize.element.offsetHeight); activeResize = {}; document.body.style.cursor = ''; } });
    
    el.deleteAudioBtn?.addEventListener('click', handleDeleteAudio);

    el.importBtn?.addEventListener('click', () => { el.importTextarea.value = ''; el.importModal.classList.remove('hidden'); });
    el.importCancelBtn?.addEventListener('click', () => el.importModal.classList.add('hidden'));
    el.importConfirmBtn?.addEventListener('click', handleImport);

    el.historyBtn?.addEventListener('click', () => openHistoryModal(songDataManager.getSongData(), renderPreview, renderTransposedTabForHistory));

    setupNotationPalette();
    setupChordHover();

    el.manageStemsBtn?.addEventListener('click', () => stemManager.openModal(songDataManager.getSongData()));
    el.printPdfBtn?.addEventListener('click', handlePrintPDF);
}

function renderSong() {
    const songData = songDataManager.getSongData();
    updateUIFromData(songData);
    
    UI.renderSongBlocks(el.songBlocksContainer, songData.song_blocks, UI.createBlockElement, initializeSortable);
    
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
    enforcePermissionsOnUI(); // Apply permission checks to the UI
    renderPreview();
    updateSoundingKey();
    updateSetlistSongContext(songData);
}

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
    el.manageStemsBtn.disabled = !songData.id;
    el.printPdfBtn.disabled = !songData.id; // Can only print saved songs
}

// NEW FUNCTION: Enforces UI state based on user permissions
function enforcePermissionsOnUI() {
    const canUseStems = userPermissions.can_use_stems;
    const canUseSetlists = userPermissions.can_use_setlists;
    
    // Voice Memos & Stems
    el.recordBtn.disabled = !canUseStems;
    el.manageStemsBtn.disabled = !canUseStems || !songDataManager.getSongData().id;
    if (!canUseStems) {
        const audioSection = document.getElementById('audioSection');
        if (!audioSection.querySelector('.upgrade-prompt')) {
            const prompt = document.createElement('p');
            prompt.className = 'upgrade-prompt text-sm text-yellow-400';
            prompt.textContent = 'Voice Memos & Stem Mixer are premium features. Upgrade to enable.';
            audioSection.appendChild(prompt);
        }
    }

    // Interactive Editors (Tab & Drum)
    document.querySelectorAll('[data-action="add"][data-type="tab"], [data-action="add"][data-type="drum_tab"]')
        .forEach(button => {
            button.disabled = !canUseSetlists; // Tab/Drum editors are tied to setlist/paid plans
            if (!canUseSetlists) {
                button.title = "Upgrade to a paid plan to use interactive editors.";
                button.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });
}

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
        if (userPermissions.can_use_stems) {
            stemManager.loadStemsForMixer(id === 'new' ? null : id);
        }
    } catch (error) {
        UI.setStatus(el.statusMessage, `Error loading song: ${error.message}`, true);
        await songDataManager.loadSong('new');
        renderSong();
    }
}

async function handleSave() {
    // FIXED: Add song limit check here
    if (!isDemo && userPermissions.song_limit !== -1) {
        const songData = songDataManager.getSongData();
        if (!songData.id) { // Only check for new songs
            const songs = await api.getSheets();
            if (songs.length >= userPermissions.song_limit) {
                alert(`You have reached the ${userPermissions.song_limit}-song limit for the free plan. Please upgrade to save more songs.`);
                UI.setStatus(el.statusMessage, 'Song limit reached.', true);
                return;
            }
        }
    }

    el.saveBtn.disabled = true;
    UI.setStatus(el.statusMessage, 'Saving...');
    try {
        const savedSong = await songDataManager.saveSong(isDemo);
        if (savedSong) {
            UI.setStatus(el.statusMessage, 'Saved successfully!');
            if (!el.songSelector.querySelector(`option[value="${savedSong.id}"]`)) {
                await UI.loadSheetList(el.songSelector, api, savedSong.id);
            }
            if (userPermissions.can_use_stems) {
                 stemManager.loadStemsForMixer(savedSong.id);
            }
            renderSong();
        }
    } catch (error) {
        UI.setStatus(el.statusMessage, `Save failed: ${error.message}`, true);
    } finally {
        if (!isDemo) el.saveBtn.disabled = false;
    }
}

// Other functions (handleDelete, handleMusicalSettingsChange, etc.) remain the same...

// ... (Rest of the file is unchanged, just pasting it for completeness)
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
            renderSong();
            stemManager.loadStemsForMixer(null);
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
    if (target.disabled) return; // Prevent adding disabled blocks

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
            ...songDataManager.getSongData(),
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
            await handleSave();
            renderSong();
            UI.setStatus(el.statusMessage, 'Recording deleted.', false);
        } catch (error) {
            UI.setStatus(el.statusMessage, `Failed to delete recording: ${error.message}`, true);
        }
    }
}

function handleRecordingFinished(audioUrl) {
    songDataManager.updateSongField('audio_url', audioUrl);
    handleSave();
    renderSong();
}

function setupChordHover() {
    const previewEl = el.livePreview;
    const popupEl = document.getElementById('chord-diagram-popup');
    if (!previewEl || !popupEl) return;
    
    let hoverTimeout;
    
    previewEl.addEventListener('mouseover', (e) => {
        const chordSpan = e.target.closest('.chord-span');
        if (!chordSpan) return;

        const chordText = chordSpan.textContent.trim();
        if (!chordText) return;

        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(async () => {
            try {
                let diagramSvg = sessionStorage.getItem(`chord-diagram-${chordText}`);
                
                if (!diagramSvg) {
                    const diagrams = await getChordDiagrams(chordText);
                    const guitarDiagram = diagrams.find(d => d.instrument === 'guitar');
                    if (guitarDiagram) {
                        diagramSvg = diagramRenderer.renderGuitarDiagram(guitarDiagram.diagram_data);
                        sessionStorage.setItem(`chord-diagram-${chordText}`, diagramSvg);
                    }
                }
                
                if (diagramSvg) {
                    popupEl.innerHTML = diagramSvg;
                    
                    const rect = chordSpan.getBoundingClientRect();
                    popupEl.style.left = `${rect.left}px`;
                    if (rect.bottom + 170 > window.innerHeight) {
                        popupEl.style.top = `${rect.top - 170}px`;
                    } else {
                        popupEl.style.top = `${rect.bottom + 5}px`;
                    }
                    popupEl.classList.remove('hidden');
                }
            } catch (error) {
                console.warn(`Could not fetch diagram for ${chordText}:`, error.message);
            }
        }, 200);
    });

    previewEl.addEventListener('mouseout', (e) => {
        const chordSpan = e.target.closest('.chord-span');
        if (chordSpan) {
            clearTimeout(hoverTimeout);
            popupEl.classList.add('hidden');
        }
    });
}

async function loadChords(isUserLoggedIn) {
    try {
        const chords = !isUserLoggedIn
            ? ['A', 'Am', 'B', 'C', 'Cmaj7', 'D', 'Dm', 'E', 'Em', 'E7', 'F', 'G'].map(name => ({name}))
            : await api.getChords();
        UI.renderChordPalette(el.chordPalette, chords, handleChordClick);
    } catch(e) { 
        if (isUserLoggedIn) UI.setStatus(el.statusMessage, 'Failed to load chords.', true);
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
        await loadChords(true);
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
    return UI.Fretboard.renderTransposedTab(tabBlock, songData.tuning, songData.capo, songData.transpose);
}

function renderTransposedTabForHistory(tabBlock, historyData) {
     return UI.Fretboard.renderTransposedTab(tabBlock, historyData.tuning, historyData.capo, historyData.transpose);
}

// NEW FUNCTION: Handle PDF printing from the tool
async function handlePrintPDF() {
    const songData = songDataManager.getSongData();
    if (!songData.id) {
        alert("Please save the song before printing.");
        return;
    }
    UI.setStatus(el.statusMessage, 'Generating PDF...');

    try {
        let printHtml = `<html><head><title>${songData.title}</title><style>body{font-family:Arial,sans-serif;margin:40px;}.song-title{font-size:28px;font-weight:bold;}.song-meta{font-size:16px;color:#555;margin-bottom:20px;}.block{page-break-inside:avoid;margin-bottom:20px;}.block-label{font-size:20px;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:5px;margin-bottom:10px;}.block-content{white-space:pre-wrap;font-family:'Courier New',monospace;line-height:1.6;}.chord{color:#000;font-weight:bold;}</style></head><body>`;
        
        printHtml += `<h1 class="song-title">${songData.title}</h1>`;
        printHtml += `<p class="song-meta">Artist: ${songData.artist || 'Unknown'}</p>`;

        songData.song_blocks.forEach(block => {
            let blockToRender = block.type === 'reference' ? (songData.song_blocks.find(b => b.id === block.originalId) || block) : block;
            printHtml += `<div class="block"><h2 class="block-label">${blockToRender.label}</h2><div class="block-content">`;
            
            if (blockToRender.type === 'lyrics' && blockToRender.content) {
                blockToRender.content.split('\n').forEach(line => {
                    const { chordLine, lyricLine } = UI.parseLineForRender(line);
                    if (chordLine.trim()) printHtml += `<div class="chord">${chordLine.replace(/<span class="chord-span">/g, '').replace(/<\/span>/g, '')}</div>`;
                    printHtml += `<div>${lyricLine}</div>`;
                });
            } else if (blockToRender.type === 'tab') {
                printHtml += renderTransposedTab(blockToRender);
            } else if (blockToRender.type === 'drum_tab') {
                printHtml += blockToRender.content || '';
            }
            
            printHtml += `</div></div>`;
        });
        
        printHtml += '</body></html>';

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
        UI.setStatus(el.statusMessage, '');
    } catch (error) {
        UI.setStatus(el.statusMessage, `Print failed: ${error.message}`, true);
    }
}
