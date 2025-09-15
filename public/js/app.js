// --- START OF FILE public/js/app.js ---

import { checkAccess, getUserPayload } from './auth.js';
import * as api from './api.js';

const isDemoMode = window.location.pathname.includes('Demo.html');

document.addEventListener('DOMContentLoaded', () => {
    if (isDemoMode) {
        initializeAppForDemo();
    } else {
        if (checkAccess()) {
            const user = getUserPayload();
            if (user && user.force_reset) {
                document.getElementById('password-reset-modal').classList.remove('hidden');
                document.getElementById('password-reset-form').addEventListener('submit', handlePasswordReset);
            } else {
                initializeAppForLiveApp();
            }
        }
    }
});

function initializeAppForDemo() {
    console.log("Initializing in DEMO mode.");
    const coreApp = new ProAnthemApp(true);
    coreApp.init();
}

function initializeAppForLiveApp() {
    console.log("Initializing in LIVE APP mode.");
    const coreApp = new ProAnthemApp(false);
    coreApp.init();
}

async function handlePasswordReset(event) {
    event.preventDefault();
    const errorEl = document.getElementById('password-reset-error');
    errorEl.textContent = '';
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'New passwords do not match.';
        return;
    }

    try {
        await api.changePassword({ currentPassword, newPassword });
        alert('Password updated successfully! You can now use the tool.');
        document.getElementById('password-reset-modal').classList.add('hidden');
        initializeAppForLiveApp();
    } catch (error) {
        errorEl.textContent = error.message;
    }
}

function ProAnthemApp(isDemo = false) {
    this.isDemo = isDemo;
    this.songData = {};
    this.chordQueue = [];
    this.chordQueueIndex = 0;
    this.lastFocusedLyricsBlock = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.fretSelectionContext = {};
    this.selectedNote = {};
    this.activeResize = {};
    this.isDraggingNote = false;

    this.CONSTANTS = {
        CLOUDINARY_CLOUD_NAME: "dawbku2eq",
        CLOUDINARY_UPLOAD_PRESET: "project-anthem-unsigned",
        TUNINGS: { E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, DROP_C: { name: "Drop C", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'C'] } },
        STRING_CONFIG: { 6: { height: 180, stringSpacing: 28 }, 7: { height: 210, stringSpacing: 28 }, 8: { height: 240, stringSpacing: 28 } },
        FRETBOARD_CONFIG: { frets: 24, width: 8000, nutWidth: 15, fretSpacing: 80, dotFrets: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24], dotRadius: 5, noteRadius: 11 },
        SHARP_SCALE: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
    };

    this.el = {
        titleInput: document.getElementById('titleInput'), artistInput: document.getElementById('artistInput'), songBlocksContainer: document.getElementById('song-blocks-container'), addBlockButtonsContainer: document.getElementById('add-block-buttons'), livePreview: document.getElementById('livePreview'), tuningSelector: document.getElementById('tuningSelector'), capoFretInput: document.getElementById('capoFretInput'), songSelector: document.getElementById('songSelector'), saveBtn: document.getElementById('saveBtn'), deleteBtn: document.getElementById('deleteBtn'), statusMessage: document.getElementById('statusMessage'), chordPalette: document.querySelector('#sidebar #chordPalette'), newChordInput: document.querySelector('#sidebar #newChordInput'), addChordBtn: document.querySelector('#sidebar #addChordBtn'), transposeDownBtn: document.getElementById('transposeDownBtn'), transposeUpBtn: document.getElementById('transposeUpBtn'), transposeStatus: document.getElementById('transposeStatus'), chordQueueDiv: document.getElementById('chordQueue'), clearQueueBtn: document.getElementById('clearQueueBtn'), setlistBtn: document.getElementById('setlistBtn'), recordBtn: document.getElementById('recordBtn'), stopBtn: document.getElementById('stopBtn'), recordingStatus: document.getElementById('recordingStatus'), deleteAudioBtn: document.getElementById('deleteAudioBtn'),
        setlistModal: document.getElementById('setlistModal'), closeSetlistModalBtn: document.getElementById('closeSetlistModalBtn'), setlistSelector: document.getElementById('setlistSelector'), createSetlistBtn: document.getElementById('createSetlistBtn'), addSongToSetlistBtn: document.getElementById('addSongToSetlistBtn'), printSetlistBtn: document.getElementById('printSetlistBtn'), newSetlistInput: document.getElementById('newSetlistInput'), songsInSetlist: document.getElementById('songsInSetlist'), currentSetlistTitle: document.getElementById('currentSetlistTitle'), setlistDetailsSection: document.getElementById('setlistDetailsSection'), saveSetlistDetailsBtn: document.getElementById('saveSetlistDetailsBtn'), deleteSetlistBtn: document.getElementById('deleteSetlistBtn'), printDrummerSetlistBtn: document.getElementById('printDrummerSetlistBtn'),
        fretSelectionModal: document.getElementById('fret-selection-modal'), fretNumberSelector: document.getElementById('fret-number-selector'), addFretBtn: document.getElementById('add-fret-btn'), cancelFretBtn: document.getElementById('cancel-fret-btn'), soundingKeyDisplay: document.getElementById('soundingKeyDisplay'),
        importBtn: document.getElementById('importBtn'), importModal: document.getElementById('import-modal'), importTextarea: document.getElementById('import-textarea'), importConfirmBtn: document.getElementById('import-confirm-btn'), importCancelBtn: document.getElementById('import-cancel-btn'),
        setlistNoteForm: document.getElementById('setlistNoteForm'), newSetlistNoteInput: document.getElementById('newSetlistNoteInput'), addSetlistNoteBtn: document.getElementById('addSetlistNoteBtn'),
        resetDemoBtn: document.getElementById('resetDemoBtn')
    };
}

ProAnthemApp.prototype.init = function() {
    this.populateTuningSelector();
    this.attachEventListeners();
    if (this.isDemo) {
        this.loadDemoChords();
        this.initializeDemoSong();
        if (this.el.recordBtn) this.el.recordBtn.disabled = true;
    } else {
        this.loadChords();
        this.loadSheetList().then(() => this.initializeNewSong(false));
    }
};

ProAnthemApp.prototype.attachEventListeners = function() {
    this.el.resetDemoBtn?.addEventListener('click', () => { if (confirm('Are you sure?')) this.initializeDemoSong(); });
    [this.el.tuningSelector, this.el.capoFretInput].forEach(elem => elem?.addEventListener('input', () => { this.songData.tuning = this.el.tuningSelector.value; this.songData.capo = parseInt(this.el.capoFretInput.value, 10) || 0; this.renderSongBlocks(); this.updateSoundingKey(); }));
    this.el.transposeUpBtn?.addEventListener('click', () => this.handleTranspose(1));
    this.el.transposeDownBtn?.addEventListener('click', () => this.handleTranspose(-1));
    this.el.saveBtn?.addEventListener('click', this.handleSave.bind(this));
    this.el.deleteBtn?.addEventListener('click', this.handleDelete.bind(this));
    this.el.addChordBtn?.addEventListener('click', this.handleAddChord.bind(this));
    this.el.newChordInput?.addEventListener('keyup', (e) => e.key === 'Enter' && this.handleAddChord());
    this.el.clearQueueBtn?.addEventListener('click', () => { this.chordQueue = []; this.chordQueueIndex = 0; this.renderChordQueue(); });
    this.el.songBlocksContainer?.addEventListener('focusin', (e) => { if (e.target.classList.contains('lyrics-block')) this.lastFocusedLyricsBlock = e.target; });
    this.el.songBlocksContainer?.addEventListener('input', (e) => { if (e.target.dataset.field) { const blockId = e.target.closest('.song-block').dataset.blockId; this.updateBlockData(blockId, 'content', e.target.value); this.updateSoundingKey(); } });
    this.el.songBlocksContainer?.addEventListener('mousedown', (e) => { if (e.target.classList.contains('resize-handle')) { e.preventDefault(); const blockEl = e.target.closest('.song-block'); const textarea = blockEl.querySelector('.form-textarea'); if (textarea) { this.activeResize = { element: textarea, startY: e.clientY, startHeight: textarea.offsetHeight, blockId: blockEl.dataset.blockId }; document.body.style.cursor = 'ns-resize'; } } });
    document.addEventListener('mousemove', (e) => { if (this.activeResize.element) { const height = this.activeResize.startHeight + e.clientY - this.activeResize.startY; this.activeResize.element.style.height = `${Math.max(50, height)}px`; } if (this.isDraggingNote && this.selectedNote.blockId) { const block = this.songData.song_blocks.find(b => b.id === this.selectedNote.blockId); const note = block?.data?.notes[this.selectedNote.noteIndex]; if (note) { const svg = document.getElementById(`fretboard-svg-${this.selectedNote.blockId}`); const clickData = this.getFretFromClick(e, svg); if (clickData) { note.position = clickData.position; note.string = clickData.string; this.drawNotesOnFretboard(this.selectedNote.blockId); } } } });
    document.addEventListener('mouseup', () => { if (this.activeResize.element) { const newHeight = this.activeResize.element.offsetHeight; this.updateBlockData(this.activeResize.blockId, null, null, newHeight); this.activeResize = { element: null, startY: 0, startHeight: 0 }; document.body.style.cursor = ''; } if(this.isDraggingNote) { this.isDraggingNote = false; this.renderPreview(); } });
    this.el.songBlocksContainer?.addEventListener('change', (e) => { if (e.target.dataset.action === 'change-strings') { const blockId = e.target.closest('.song-block').dataset.blockId; const block = this.songData.song_blocks.find(b => b.id === blockId); if (block) { block.strings = parseInt(e.target.value, 10); this.drawFretboard(blockId); } } });
    this.el.songBlocksContainer?.addEventListener('click', this.handleSongBlockClick.bind(this));
    document.addEventListener('keydown', this.handleDeleteNote.bind(this));
    this.el.addBlockButtonsContainer?.addEventListener('click', this.handleAddBlockClick.bind(this));
    this.el.recordBtn?.addEventListener('click', this.startRecording.bind(this));
    this.el.stopBtn?.addEventListener('click', this.stopRecording.bind(this));
    this.el.songSelector?.addEventListener('change', () => this.loadSong(this.el.songSelector.value));
    this.el.setlistBtn?.addEventListener('click', this.openSetlistManager.bind(this));
    this.el.closeSetlistModalBtn?.addEventListener('click', () => this.el.setlistModal.classList.add('hidden'));
    this.el.setlistSelector?.addEventListener('change', (e) => this.handleSetlistSelection(e.target.value));
    this.el.saveSetlistDetailsBtn?.addEventListener('click', this.handleSaveSetlistDetails.bind(this));
    this.el.createSetlistBtn?.addEventListener('click', this.handleCreateSetlist.bind(this));
    this.el.addSongToSetlistBtn?.addEventListener('click', this.handleAddSongToSetlist.bind(this));
    this.el.printSetlistBtn?.addEventListener('click', () => this.handlePrintSetlist(false));
    this.el.printDrummerSetlistBtn?.addEventListener('click', () => this.handlePrintSetlist(true));
    this.el.deleteSetlistBtn?.addEventListener('click', this.handleDeleteSetlist.bind(this));
    this.el.addFretBtn?.addEventListener('click', this.confirmFretSelection.bind(this));
    this.el.cancelFretBtn?.addEventListener('click', () => this.el.fretSelectionModal.classList.add('hidden'));
    this.el.songsInSetlist?.addEventListener('click', (e) => { if (e.target.dataset.action === 'remove-item') this.handleRemoveItemFromSetlist(e.target.closest('li')); });
    this.el.addSetlistNoteBtn?.addEventListener('click', this.handleAddSetlistNote.bind(this));
    this.el.deleteAudioBtn?.addEventListener('click', this.handleDeleteAudio.bind(this));
    this.el.importBtn?.addEventListener('click', () => { this.el.importTextarea.value = ''; this.el.importModal.classList.remove('hidden'); });
    this.el.importCancelBtn?.addEventListener('click', () => this.el.importModal.classList.add('hidden'));
    this.el.importConfirmBtn?.addEventListener('click', this.handleImport.bind(this));
};

ProAnthemApp.prototype.initializeDemoSong = function() {
    this.songData = { 
        id: 'demo-song', title: 'The ProAnthem Feature Tour', artist: 'The Dev Team', audio_url: null, 
        song_blocks: [
            { id: 'block_1', type: 'lyrics', label: 'Lyrics & Chords', content: '[G]Just type your lyrics [D]in this space,\nPut [Em]chords in brackets, [C]right in place.\nThe [G]preview updates, [D]as you go,\nA [C]perfect layout for your [G]show.', height: 140 },
            { id: 'block_2', type: 'tab', label: 'Guitar Riff Example', strings: 6, data: { notes: [{string: 3, fret: 5, position: 200}, {string: 3, fret: 7, position: 350}, {string: 2, fret: 5, position: 500}, {string: 2, fret: 7, position: 650}]}, editMode: false }
        ],
        tuning: 'E_STANDARD', capo: 0, transpose: 0
    };
    this.el.titleInput.value = this.songData.title;
    this.el.artistInput.value = this.songData.artist;
    this.updateMusicalSettingsUI();
    this.renderSongBlocks();
    this.updateSoundingKey();
    this.setStatus('Demo loaded. Your changes will not be saved.');
};

ProAnthemApp.prototype.loadDemoChords = function() {
    const demoChords = ['A', 'Am', 'B', 'C', 'Cmaj7', 'D', 'Dm', 'E', 'Em', 'E7', 'F', 'G'].map(name => ({name}));
    this.renderChordPalette(demoChords);
};

ProAnthemApp.prototype.renderChordPalette = function(chords) {
    this.el.chordPalette.innerHTML = ''; 
    chords.forEach(c => { 
        const btn = document.createElement('button'); 
        btn.className = 'btn btn-secondary btn-sm'; 
        btn.textContent = c.name; 
        btn.onclick = (e) => { 
            if (e.ctrlKey || e.metaKey) { 
                this.chordQueue.push(c.name); 
                this.renderChordQueue(); 
            } else if (this.lastFocusedLyricsBlock) { 
                const t = `[${c.name}]`; 
                const p = this.lastFocusedLyricsBlock.selectionStart; 
                this.lastFocusedLyricsBlock.value = this.lastFocusedLyricsBlock.value.slice(0, p) + t + this.lastFocusedLyricsBlock.value.slice(p); 
                this.lastFocusedLyricsBlock.focus(); 
                this.lastFocusedLyricsBlock.setSelectionRange(p + t.length, p + t.length); 
                this.updateBlockData(this.lastFocusedLyricsBlock.closest('.song-block').dataset.blockId, 'content', this.lastFocusedLyricsBlock.value); 
            }
        }; 
        this.el.chordPalette.appendChild(btn); 
    });
};

ProAnthemApp.prototype.loadChords = async function() {
    try {
        const chords = await api.getChords();
        this.renderChordPalette(chords);
    } catch(e) { this.setStatus('Failed to load chords.', true); }
};

ProAnthemApp.prototype.handleSave = async function() {
    if (this.isDemo) {
        this.songData.title = this.el.titleInput.value || 'My Demo Song';
        this.songData.artist = this.el.artistInput.value || 'An Artist';
        const hasContent = this.songData.song_blocks.some(b => (b.content && b.content.trim() !== '') || (b.data && b.data.notes && b.data.notes.length > 0));
        if (!hasContent && !this.songData.title) {
            alert("Please add a title or some content before saving!");
            return;
        }
        alert("Let's save your work! We'll take you to the signup page. Your song will be waiting for you in your new account.");
        localStorage.setItem('pendingSong', JSON.stringify(this.songData));
        window.location.href = '/pricing.html';
        return;
    }

    this.el.saveBtn.disabled = true;
    this.setStatus('Saving...');
    try {
        this.songData.title = this.el.titleInput.value || 'Untitled';
        this.songData.artist = this.el.artistInput.value || 'Unknown Artist';
        const savedSong = this.songData.id ? await api.updateSheet(this.songData.id, this.songData) : await api.createSheet(this.songData);
        this.songData.id = savedSong.id;
        this.setStatus('Saved successfully!');
        if (!this.el.songSelector.querySelector(`option[value="${savedSong.id}"]`)) {
            await this.loadSheetList(savedSong.id);
        } else {
            this.el.songSelector.querySelector(`option[value="${savedSong.id}"]`).textContent = this.songData.title;
            this.el.songSelector.value = savedSong.id;
        }
    } catch (error) {
        this.setStatus(`Save failed: ${error.message}`, true);
    } finally {
        this.el.saveBtn.disabled = false;
    }
};

ProAnthemApp.prototype.loadSong = async function(id) {
    if (!id || id === 'new') { this.initializeNewSong(true); return; }
    this.setStatus('Loading song...');
    try {
        const data = await api.getSheet(id);
        this.songData = { id: data.id, title: data.title || '', artist: data.artist || '', audio_url: data.audio_url, song_blocks: Array.isArray(data.song_blocks) ? data.song_blocks : [], tuning: data.tuning ?? 'E_STANDARD', capo: data.capo ?? 0, transpose: data.transpose ?? 0 };
        this.el.titleInput.value = this.songData.title;
        this.el.artistInput.value = this.songData.artist;
        const audioPlayerContainer = document.getElementById('audioPlayerContainer');
        const audioPlayer = document.getElementById('audioPlayer');
        if (this.songData.audio_url) { audioPlayerContainer.classList.remove('hidden'); audioPlayer.src = this.songData.audio_url; } else { audioPlayerContainer.classList.add('hidden'); audioPlayer.src = ''; }
        this.updateMusicalSettingsUI();
        this.renderSongBlocks();
        this.setStatus('Song loaded.');
        this.updateSoundingKey();
    } catch (error) {
        this.setStatus(`Error loading song: ${error.message}`, true);
        this.initializeNewSong(true);
    }
};

ProAnthemApp.prototype.initializeNewSong = async function(forceNew = false) {
    const createBlankSong = () => {
        this.songData = { id: null, title: '', artist: '', audio_url: null, song_blocks: [{ id: `block_${Date.now()}`, type: 'lyrics', label: 'Verse 1', content: '', height: 100 }], tuning: 'E_STANDARD', capo: 0, transpose: 0 };
        this.el.titleInput.value = '';
        this.el.artistInput.value = '';
        if (this.el.songSelector) this.el.songSelector.value = 'new';
        document.getElementById('audioPlayerContainer')?.classList.add('hidden');
        document.getElementById('audioPlayer')?.setAttribute('src', '');
        this.updateMusicalSettingsUI();
        this.renderSongBlocks();
        this.updateSoundingKey();
    };

    if (forceNew) { createBlankSong(); return; }
    try {
        const songs = await api.getSheets();
        if (songs && songs.length > 0) {
            await this.loadSong(songs[0].id);
            if (this.el.songSelector) this.el.songSelector.value = songs[0].id;
        } else {
            createBlankSong();
        }
    } catch (e) {
        createBlankSong();
        this.setStatus('Could not load songs. Starting new.', true);
    }
};

ProAnthemApp.prototype.handleDelete = async function() {
    if (this.isDemo) { this.setStatus('Deleting is disabled in the demo.', true); return; }
    if (!this.songData.id) { this.setStatus("Cannot delete an unsaved song.", true); return; }
    if (confirm(`Are you sure you want to delete "${this.songData.title}"?`)) {
        try {
            this.setStatus('Deleting...');
            await api.deleteSheet(this.songData.id);
            this.setStatus('Song deleted.');
            await this.loadSheetList();
            await this.initializeNewSong();
        } catch (e) {
            this.setStatus(`Failed to delete: ${e.message}`, true);
        }
    }
};

ProAnthemApp.prototype.handleAddChord = async function() {
    if (this.isDemo) { 
        this.setStatus('Cannot save new chords in demo.', true); 
        return; 
    }
    const name = this.el.newChordInput.value.trim();
    if (!name) return;
    try {
        await api.createChord({ name });
        this.el.newChordInput.value = '';
        this.setStatus(`'${name}' added.`);
        await this.loadChords();
    } catch (e) {
        this.setStatus(e.message, true);
    }
};

ProAnthemApp.prototype.setStatus = function(message, isError = false) {
    if (!this.el.statusMessage) return;
    this.el.statusMessage.textContent = message;
    this.el.statusMessage.style.color = isError ? '#ef4444' : '#9ca3af';
    if (message) setTimeout(() => {
        if (this.el.statusMessage) this.el.statusMessage.textContent = '';
    }, 3000);
};

ProAnthemApp.prototype.updateMusicalSettingsUI = function() {
    if (this.el.tuningSelector) this.el.tuningSelector.value = this.songData.tuning;
    if (this.el.capoFretInput) this.el.capoFretInput.value = this.songData.capo;
    if (this.el.transposeStatus) {
        const steps = this.songData.transpose;
        this.el.transposeStatus.textContent = steps > 0 ? `+${steps}` : steps;
    }
};

ProAnthemApp.prototype.parsePastedSong = function(text) {
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
};

ProAnthemApp.prototype.handleImport = function() {
    const pastedText = this.el.importTextarea.value;
    if (!pastedText.trim()) { alert('Please paste some song text to import.'); return; }
    const result = this.parsePastedSong(pastedText);
    if (result.blocks.length > 0) {
        this.songData = { id: null, title: 'Imported Song', artist: '', audio_url: null, song_blocks: result.blocks, tuning: result.metadata.tuning, capo: result.metadata.capo, transpose: 0 };
        this.el.titleInput.value = this.songData.title;
        this.el.artistInput.value = this.songData.artist;
        if (this.el.songSelector) this.el.songSelector.value = 'new';
        this.updateMusicalSettingsUI();
        this.renderSongBlocks();
        this.updateSoundingKey();
        this.setStatus('Song imported successfully! Remember to save.');
    } else {
        this.setStatus('Could not find any content to import.', true);
    }
    this.el.importModal.classList.add('hidden');
};

ProAnthemApp.prototype.updateSoundingKey = function() { const capoFret = this.songData.capo || 0; let firstChord = null; for (const block of this.songData.song_blocks) { if (block.type === 'lyrics' && block.content) { const match = block.content.match(/\[([^\]]+)\]/); if (match) { firstChord = match[1]; break; } } } if (!firstChord) { this.el.soundingKeyDisplay.textContent = '-'; return; } const soundingKey = this.transposeChord(firstChord, capoFret); this.el.soundingKeyDisplay.textContent = soundingKey; };
ProAnthemApp.prototype.openSetlistManager = async function() { if (!document.getElementById('tool-content')?.classList.contains('hidden')) { this.el.setlistModal.classList.remove('hidden'); await this.loadSetlists(); this.handleSetlistSelection(null); } };
ProAnthemApp.prototype.loadSetlists = async function(selectId = null) { try { const lists = this.isDemo ? [{id: 1, name: "Demo Setlist"}] : await this.api.getSetlists(); this.el.setlistSelector.innerHTML = '<option value="">-- Select a Setlist --</option>'; lists.forEach(list => { const option = document.createElement('option'); option.value = list.id; option.textContent = list.name; this.el.setlistSelector.appendChild(option); }); if (selectId) { this.el.setlistSelector.value = selectId; await this.handleSetlistSelection(selectId); } } catch (error) { this.setStatus('Failed to load setlists.', true); } };
ProAnthemApp.prototype.handleSetlistSelection = async function(setlistId) { if (this.el.songsInSetlist.sortableInstance) { this.el.songsInSetlist.sortableInstance.destroy(); this.el.songsInSetlist.sortableInstance = null; } if (!setlistId) { this.el.currentSetlistTitle.textContent = 'Select a setlist'; this.el.setlistDetailsSection.classList.add('hidden'); this.el.setlistNoteForm.classList.add('hidden'); this.el.songsInSetlist.innerHTML = ''; [this.el.addSongToSetlistBtn, this.el.printSetlistBtn, this.el.printDrummerSetlistBtn, this.el.deleteSetlistBtn].forEach(b => b.disabled = true); return; } try { const setlist = this.isDemo ? {name: "Demo Setlist", songs: []} : await this.api.getSetlist(setlistId); this.el.currentSetlistTitle.textContent = setlist.name; document.getElementById('setlistVenue').value = setlist.venue || ''; document.getElementById('setlistDate').value = setlist.event_date ? setlist.event_date.split('T')[0] : ''; document.getElementById('setlistLogoUrl').value = setlist.logo_url || ''; let extraData = { order: [], notes: [] }; try { const notesField = document.getElementById('setlistNotes'); notesField.value = setlist.notes || ''; const parsedNotes = JSON.parse(setlist.notes || '{}'); if (parsedNotes.order && Array.isArray(parsedNotes.notes)) extraData = parsedNotes; } catch (e) {} this.el.setlistDetailsSection.classList.remove('hidden'); this.el.setlistNoteForm.classList.remove('hidden'); this.el.songsInSetlist.innerHTML = ''; const allItemsMap = new Map(); (setlist.songs || []).forEach(s => allItemsMap.set(s.id.toString(), { ...s, type: 'song' })); (extraData.notes || []).forEach(n => allItemsMap.set(n.id.toString(), n)); const orderedItems = (extraData.order.length > 0 ? extraData.order : (setlist.songs || []).map(s => s.id)) .map(id => allItemsMap.get(id.toString())).filter(Boolean); orderedItems.forEach(item => { const li = document.createElement('li'); li.className = 'flex justify-between items-center p-2 bg-gray-700 rounded cursor-grab'; const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`; if (item.type === 'song') { li.dataset.itemId = item.id; li.dataset.itemType = 'song'; li.innerHTML = `<span>${gripHandle}${item.title} - <em class="text-gray-400">${item.artist}</em></span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button>`; } else { li.dataset.itemId = item.id; li.dataset.itemType = 'note'; li.classList.add('bg-gray-750', 'border', 'border-dashed', 'border-gray-600'); li.innerHTML = `<span>${gripHandle}<em class="text-indigo-300">${item.title}</em></span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button>`; } this.el.songsInSetlist.appendChild(li); }); this.el.songsInSetlist.sortableInstance = new Sortable(this.el.songsInSetlist, { animation: 150, ghostClass: 'sortable-ghost', onEnd: () => this.saveSetlistOrderAndNotes() }); this.el.addSongToSetlistBtn.disabled = !this.songData.id; [this.el.printSetlistBtn, this.el.printDrummerSetlistBtn, this.el.deleteSetlistBtn].forEach(b => b.disabled = false); } catch (error) { this.setStatus(`Failed to load setlist details: ${error.message}`, true); } };
ProAnthemApp.prototype.saveSetlistOrderAndNotes = async function() { if(this.isDemo) {this.setStatus('Setlists not saved in demo.'); return;} const setlistId = this.el.setlistSelector.value; if (!setlistId) return; this.setStatus('Saving setlist...'); const listItems = Array.from(this.el.songsInSetlist.children); const song_ids = [], notes = [], order = []; listItems.forEach(li => { const id = li.dataset.itemId; const type = li.dataset.itemType; order.push(id); if (type === 'song') { song_ids.push(id); } else if (type === 'note') { notes.push({ id: id, type: 'note', title: li.querySelector('em').textContent }); } }); const extraDataPayload = { order, notes }; document.getElementById('setlistNotes').value = JSON.stringify(extraDataPayload); try { await Promise.all([ this.api.updateSetlistSongOrder(setlistId, song_ids), this.handleSaveSetlistDetails() ]); this.setStatus('Setlist saved!', false); } catch (error) { this.setStatus(`Error saving setlist: ${error.message}`, true); await this.handleSetlistSelection(setlistId); } };
ProAnthemApp.prototype.handleSaveSetlistDetails = async function() { if(this.isDemo) {this.setStatus('Setlists not saved in demo.'); return;} const setlistId = this.el.setlistSelector.value; if (!setlistId) return; const payload = { name: this.el.currentSetlistTitle.textContent, venue: document.getElementById('setlistVenue').value, event_date: document.getElementById('setlistDate').value, logo_url: document.getElementById('setlistLogoUrl').value, notes: document.getElementById('setlistNotes').value }; try { await this.api.updateSetlistDetails(setlistId, payload); this.setStatus('Setlist details saved!', false); } catch (error) { this.setStatus(`Error saving details: ${error.message}`, true); } };
ProAnthemApp.prototype.handleCreateSetlist = async function() { if(this.isDemo) {this.setStatus('Setlists not saved in demo.'); return;} const name = this.el.newSetlistInput.value.trim(); if (!name) return alert('Please enter a name for the new setlist.'); try { const newSetlist = await this.api.createSetlist({ name }); this.el.newSetlistInput.value = ''; this.setStatus('Setlist created!', false); await this.loadSetlists(newSetlist.id); } catch (error) { this.setStatus(`Error creating setlist: ${error.message}`, true); } };
ProAnthemApp.prototype.handleDeleteSetlist = async function() { if(this.isDemo) {this.setStatus('Setlists not saved in demo.'); return;} const setlistId = this.el.setlistSelector.value; const setlistName = this.el.setlistSelector.options[this.el.setlistSelector.selectedIndex].text; if (!setlistId) return; if (confirm(`ARE YOU SURE you want to permanently delete the setlist "${setlistName}"? This cannot be undone.`)) { try { await this.api.deleteSetlist(setlistId); this.setStatus(`Setlist "${setlistName}" deleted.`, false); await this.loadSetlists(); this.handleSetlistSelection(null); } catch(error) { this.setStatus(`Failed to delete setlist: ${error.message}`, true); } } };
ProAnthemApp.prototype.handleAddSongToSetlist = async function() { if(this.isDemo) {this.setStatus('Setlists not saved in demo.'); return;} const setlistId = this.el.setlistSelector.value; if (!this.songData.id) return alert('Please save the current song before adding it to a setlist.'); if (!setlistId) return alert('Please select a setlist first.'); try { await this.api.addSongToSetlist(setlistId, this.songData.id); this.setStatus(`'${this.songData.title}' added to setlist.`, false); await this.handleSetlistSelection(setlistId); } catch(error) { this.setStatus(`Failed to add song: ${error.message}`, true); } };
ProAnthemApp.prototype.handleRemoveItemFromSetlist = async function(itemLi) { if(this.isDemo) {this.setStatus('Setlists not saved in demo.'); itemLi.remove(); return;} const setlistId = this.el.setlistSelector.value; const itemId = itemLi.dataset.itemId; const itemType = itemLi.dataset.itemType; if (!setlistId || !itemId) return; if (confirm("Are you sure you want to remove this item from the setlist?")) { try { if (itemType === 'song') { await this.api.removeSongFromSetlist(setlistId, itemId); } itemLi.remove(); await this.saveSetlistOrderAndNotes(); } catch(error) { this.setStatus(`Failed to remove item: ${error.message}`, true); await this.handleSetlistSelection(setlistId); } } };
ProAnthemApp.prototype.handlePrintSetlist = async function(drummerMode) { if (this.isDemo) { this.setStatus('Printing is disabled in demo.', true); return; } const setlistId = this.el.setlistSelector.value; if (!setlistId) return; this.setStatus('Generating PDF...'); try { const setlist = await this.api.getSetlist(setlistId); let extraData = { order: [], notes: [] }; try { const parsedNotes = JSON.parse(setlist.notes || '{}'); if (parsedNotes.order && Array.isArray(parsedNotes.notes)) extraData = parsedNotes; } catch (e) {} const allItemsMap = new Map(); (setlist.songs || []).forEach(s => allItemsMap.set(s.id.toString(), { ...s, type: 'song' })); (extraData.notes || []).forEach(n => allItemsMap.set(n.id.toString(), n)); const orderedItems = (extraData.order.length > 0 ? extraData.order : (setlist.songs || []).map(s => s.id)) .map(id => allItemsMap.get(id.toString())).filter(Boolean); const { jsPDF } = window.jspdf; const doc = new jsPDF(); const leftMargin = 15, rightMargin = doc.internal.pageSize.getWidth() - 15, yStart = 20; let y = yStart; const pageHeight = doc.internal.pageSize.getHeight(), marginBottom = 20, maxWidth = rightMargin - leftMargin; const getImageDataUrl = async (url) => { if (!url) return Promise.resolve(null); return new Promise((resolve) => { const img = new Image(); img.crossOrigin = 'Anonymous'; img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }; img.onerror = () => { console.error('Failed to load watermark image.'); resolve(null); }; img.src = url; }); }; const logoDataUrl = await getImageDataUrl(setlist.logo_url); const addWatermarkToPage = () => { if (logoDataUrl) { doc.setGState(new doc.GState({opacity: 0.1})); doc.addImage(logoDataUrl, 'PNG', rightMargin - 20, 10, 20, 20); doc.setGState(new doc.GState({opacity: 1.0})); } }; const checkPageBreak = (neededHeight) => { if (y + neededHeight > pageHeight - marginBottom) { addWatermarkToPage(); doc.addPage(); y = yStart; addWatermarkToPage(); } }; addWatermarkToPage(); doc.setFontSize(26); doc.text(setlist.name, doc.internal.pageSize.getWidth() / 2, y, { align: 'center', maxWidth }); y += 15; doc.setFontSize(16); if (setlist.venue) { doc.text(setlist.venue, doc.internal.pageSize.getWidth() / 2, y, { align: 'center', maxWidth }); y += 8; } if (setlist.event_date) { doc.text(new Date(setlist.event_date).toLocaleDateString(undefined, { timeZone: 'UTC' }), doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); } y += 15; doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('Song List:', leftMargin, y); y += 8; doc.setFont(undefined, 'normal'); orderedItems.forEach((item, index) => { checkPageBreak(8); let titleText; if (item.type === 'song') { titleText = `${index + 1}. ${item.title} (${item.artist || 'Unknown'})`; const splitTitle = doc.splitTextToSize(titleText, maxWidth - 5); doc.text(splitTitle, leftMargin + 5, y); y += splitTitle.length * 7; } else { titleText = `${index + 1}. --- ${item.title} ---`; doc.setFont(undefined, 'italic'); doc.text(titleText, leftMargin + 5, y); y += 7; doc.setFont(undefined, 'normal'); } }); for (const item of orderedItems) { addWatermarkToPage(); doc.addPage(); y = yStart; addWatermarkToPage(); if (item.type === 'song') { doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(item.title, leftMargin, y, { maxWidth }); y += 8; doc.setFontSize(14); doc.setFont(undefined, 'italic'); doc.text(item.artist || 'Unknown Artist', leftMargin, y, { maxWidth }); y += 12; const songBlocks = (typeof item.song_blocks === 'string') ? JSON.parse(item.song_blocks || '[]') : (item.song_blocks || []); for (const block of songBlocks) { let blockToRender = block.type === 'reference' ? (songBlocks.find(b => b.id === block.originalId) || block) : block; if (!blockToRender || (!blockToRender.content && (!blockToRender.data || !blockToRender.data.notes))) continue; if(drummerMode && !(blockToRender.type === 'lyrics' || blockToRender.type === 'drum_tab')) continue; if(!drummerMode && blockToRender.type === 'drum_tab') continue; checkPageBreak(12); doc.setFont(undefined, 'bold'); doc.setFontSize(12); doc.text(block.label, leftMargin, y, { maxWidth }); y += 7; doc.setFont('Courier', 'normal'); doc.setFontSize(10); const lineHeight = 5; const contentToRender = blockToRender.type === 'tab' ? this.renderTransposedTab(blockToRender) : (blockToRender.content || ''); for (const line of contentToRender.split('\n')) { if (blockToRender.type === 'lyrics') { const parsed = this.parseLineForRender(line); if (!drummerMode) { checkPageBreak(lineHeight * 2.5); doc.setTextColor(60, 60, 60); doc.text(parsed.chordLine, leftMargin, y, { maxWidth }); y += lineHeight; } else { checkPageBreak(lineHeight * 1.5); } doc.setTextColor(0, 0, 0); const splitLyrics = doc.splitTextToSize(parsed.lyricLine, maxWidth); doc.text(splitLyrics, leftMargin, y); y += (splitLyrics.length * lineHeight) + (lineHeight * 0.5); } else if (blockToRender.type === 'tab' || blockToRender.type === 'drum_tab') { const splitText = doc.splitTextToSize(line, maxWidth); checkPageBreak(splitText.length * lineHeight); doc.setTextColor(0,0,0); doc.text(splitText, leftMargin, y); y += (splitText.length * lineHeight) + (lineHeight * 0.5); } } y += lineHeight; } } else { doc.setFontSize(22); doc.setFont(undefined, 'bold'); doc.text(item.title, doc.internal.pageSize.getWidth() / 2, pageHeight / 2, { align: 'center', maxWidth }); } } addWatermarkToPage(); doc.save(`${setlist.name.replace(/\s/g, '_')}${drummerMode ? '_Drummer' : ''}.pdf`); this.setStatus('PDF generated.', false); } catch (error) { this.setStatus(`Failed to generate PDF: ${error.message}`, true); console.error("PDF generation error:", error); } };
ProAnthemApp.prototype.renderSongBlocks = function() { this.el.songBlocksContainer.innerHTML = ''; (this.songData.song_blocks || []).forEach(block => this.el.songBlocksContainer.appendChild(this.createBlockElement(block))); this.renderAddBlockButtons(); this.renderPreview(); this.initializeSortable(); };
ProAnthemApp.prototype.createBlockElement = function(block) { const div = document.createElement('div'); div.className = 'song-block'; div.dataset.blockId = block.id; let contentHtml = '', headerControls = ''; const drumPlaceholder = `HH|x-x-x-x-x-x-x-x-|\nSD|----o-------o---|\nBD|o-------o-------|`; if (block.type === 'lyrics') { contentHtml = `<textarea class="form-textarea lyrics-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="Enter lyrics and [chords]...">${block.content || ''}</textarea><div class="resize-handle"></div>`; } else if (block.type === 'tab') { const stringOptions = [6, 7, 8].map(num => `<option value="${num}" ${block.strings === num ? 'selected' : ''}>${num}-String</option>`).join(''); contentHtml = `<div class="mb-2"><label class="text-xs text-gray-400">Instrument:</label><select class="form-select form-input text-sm w-32 bg-gray-900" data-action="change-strings">${stringOptions}</select></div><div class="fretboard-wrapper"><div id="fretboard-${block.id}"></div></div>`; const isEditMode = block.editMode || false; const editButtonClass = isEditMode ? 'btn-edit-mode' : 'btn-secondary'; headerControls = `<button class="btn ${editButtonClass} btn-sm" data-action="edit-tab">${isEditMode ? 'Done Editing' : 'Edit'}</button>`; } else if (block.type === 'drum_tab') { contentHtml = `<textarea class="form-textarea drum-tab-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="${drumPlaceholder}">${block.content || ''}</textarea><div class="resize-handle"></div>`; } else if (block.type === 'reference') { const originalBlock = this.songData.song_blocks.find(b => b.id === block.originalId); contentHtml = `<div class="p-4 bg-gray-800 rounded-md text-gray-400 italic">Reference to: ${originalBlock ? originalBlock.label : 'Unknown Section'}</div>`; } div.innerHTML = `<div class="block-header"><div class="flex items-center gap-4"><div class="flex items-center gap-2"><span class="font-bold">${block.label}</span><span class="text-xs text-gray-400">(${block.type.replace('_', ' ')})</span></div></div><div class="flex items-center gap-2">${headerControls}<button class="btn-sm text-xs hover:underline" data-action="rename">Rename</button><button class="btn-sm text-red-400 hover:underline" data-action="delete">Delete</button></div></div><div class="block-content">${contentHtml}</div>`; if (block.type === 'tab') setTimeout(() => this.drawFretboard(block.id), 0); return div; };
ProAnthemApp.prototype.renderAddBlockButtons = function() { const createdSections = this.songData.song_blocks.filter(b => b.type !== 'reference'); let referenceButtonsHtml = ''; if (createdSections.length > 0) { const refItems = createdSections.map(b => `<a href="#" class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600" data-original-id="${b.id}" role="menuitem">${b.label}</a>`).join(''); referenceButtonsHtml = `<div class="relative inline-block text-left"><button id="insert-ref-btn" class="btn btn-secondary">Insert Existing Section</button><div id="ref-dropdown" class="hidden origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10"><div class="py-1" role="menu" aria-orientation="vertical">${refItems}</div></div></div>`; } this.el.addBlockButtonsContainer.innerHTML = `<button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Verse </button><button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Chorus </button><button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Bridge </button><button class="btn btn-secondary" data-action="add" data-type="tab"> + Tab Section </button><button class="btn btn-secondary" data-action="add" data-type="drum_tab"> + Drum Tab </button>${referenceButtonsHtml}`; };
ProAnthemApp.prototype.renderPreview = function() { let previewHtml = ''; (this.songData.song_blocks || []).forEach(block => { let blockToRender = block.type === 'reference' ? (this.songData.song_blocks.find(b => b.id === block.originalId) || block) : block; previewHtml += `<h4 class="text-lg font-bold mt-4 text-gray-400">${block.label}</h4>`; if (!blockToRender) return; if (blockToRender.type === 'lyrics') { (blockToRender.content || '').split('\n').forEach(line => { const parsed = this.parseLineForRender(line); previewHtml += `<div class="live-preview-chords">${parsed.chordLine}</div><div>${parsed.lyricLine}</div>`; }); } else if (blockToRender.type === 'tab') { previewHtml += `<div class="tab-preview">${this.renderTransposedTab(blockToRender)}</div>`; } else if (blockToRender.type === 'drum_tab') { previewHtml += `<div class="tab-preview">${blockToRender.content || ''}</div>`; } }); this.el.livePreview.innerHTML = previewHtml; };
ProAnthemApp.prototype.getFretFromClick = function(evt, svgEl) { const block = this.songData.song_blocks.find(b => b.id === svgEl.id.split('-').pop()); return Fretboard.getFretFromClick(evt, svgEl, block.strings || 6, this.CONSTANTS.STRING_CONFIG, this.CONSTANTS.FRETBOARD_CONFIG); };
ProAnthemApp.prototype.drawFretboard = function(blockId) { const block = this.songData.song_blocks.find(b => b.id === blockId); if (!block) return; Fretboard.drawFretboard(blockId, block.strings || 6, this.CONSTANTS.TUNINGS, this.CONSTANTS.STRING_CONFIG, this.CONSTANTS.FRETBOARD_CONFIG, (id) => this.drawNotesOnFretboard(id), (svgEl) => this.attachFretboardListeners(svgEl)); };
ProAnthemApp.prototype.drawNotesOnFretboard = function(blockId) { const block = this.songData.song_blocks.find(b => b.id === blockId); if (!block) return; Fretboard.drawNotesOnFretboard(blockId, block.data.notes, this.selectedNote, block.strings || 6, this.songData.tuning, this.songData.capo, this.CONSTANTS.TUNINGS, this.CONSTANTS.STRING_CONFIG, this.CONSTANTS.FRETBOARD_CONFIG); };
ProAnthemApp.prototype.renderTransposedTab = function(tabBlock) { return Fretboard.renderTransposedTab(tabBlock, this.songData.tuning, this.songData.capo, this.songData.transpose, this.CONSTANTS.TUNINGS, this.CONSTANTS.FRETBOARD_CONFIG); };
ProAnthemApp.prototype.updateBlockData = function(blockId, field, value, height) { const block = this.songData.song_blocks.find(b => b.id === blockId); if (block) { if (field !== null) block[field] = value; if (height !== null) block.height = height; if (field === 'content') this.renderPreview(); } };
ProAnthemApp.prototype.initializeSortable = function() { if (this.el.songBlocksContainer.sortableInstance) { this.el.songBlocksContainer.sortableInstance.destroy(); } this.el.songBlocksContainer.sortableInstance = new Sortable(this.el.songBlocksContainer, { animation: 150, handle: '.block-header', onEnd: (evt) => { const [movedItem] = this.songData.song_blocks.splice(evt.oldIndex, 1); this.songData.song_blocks.splice(evt.newIndex, 0, movedItem); this.renderPreview(); } }); };
ProAnthemApp.prototype.parseLineForRender = function(rawLine) { if (!rawLine || !rawLine.trim()) return { chordLine: ' ', lyricLine: ' ' }; let chordLine = ""; let lyricLine = ""; const parts = rawLine.split(/(\[[^\]]+\])/g); for (const part of parts) { if (part.startsWith('[') && part.endsWith(']')) { const chordName = part.slice(1, -1); chordLine += chordName; lyricLine += ' '.repeat(chordName.length); } else { lyricLine += part; chordLine += ' '.repeat(part.length); } } return { chordLine: chordLine.trimEnd() || ' ', lyricLine: lyricLine.trimEnd() || ' ' }; };
ProAnthemApp.prototype.populateTuningSelector = function() { for (const key in this.CONSTANTS.TUNINGS) { const option = document.createElement('option'); option.value = key; option.textContent = this.CONSTANTS.TUNINGS[key].name; this.el.tuningSelector.appendChild(option); } };
ProAnthemApp.prototype.loadSheetList = async function(selectId = null) { try { const songs = await this.api.getSheets(); songs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)); this.el.songSelector.innerHTML = '<option value="new">-- Create New Song --</option>'; songs.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title || 'Untitled'; this.el.songSelector.appendChild(o); }); if (selectId) this.el.songSelector.value = selectId; } catch (e) { this.setStatus('Failed to load songs.', true); } };
ProAnthemApp.prototype.transposeChord = function(chord, amount) { const regex = /^([A-G][b#]?)(.*)/; const match = chord.match(regex); if (!match) return chord; let note = match[1]; let index = this.CONSTANTS.SHARP_SCALE.indexOf(note); if (index === -1) { const flatNotes = { 'Bb':'A#', 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#'}; note = flatNotes[note] || note; index = this.CONSTANTS.SHARP_SCALE.indexOf(note); } if (index === -1) return chord; const newIndex = (index + amount + 12) % 12; return this.CONSTANTS.SHARP_SCALE[newIndex] + match[2]; };
ProAnthemApp.prototype.handleTranspose = function(amount) { this.songData.transpose += amount; this.updateMusicalSettingsUI(); this.songData.song_blocks.forEach(block => { if (block.type === 'lyrics' && block.content) { block.content = block.content.replace(/\[([^\]]+)\]/g, (match, chord) => `[${this.transposeChord(chord, amount)}]`); } }); this.renderSongBlocks(); };
ProAnthemApp.prototype.renderChordQueue = function() { this.el.chordQueueDiv.innerHTML = ''; if (this.chordQueue.length === 0) { document.querySelectorAll('.lyrics-block').forEach(el => el.classList.remove('placement-mode')); this.el.clearQueueBtn.disabled = true; return; } document.querySelectorAll('.lyrics-block').forEach(el => el.classList.add('placement-mode')); this.el.clearQueueBtn.disabled = false; this.chordQueue.forEach((name, index) => { const pill = document.createElement('span'); pill.className = `queue-pill ${index === this.chordQueueIndex ? 'next' : ''}`; pill.textContent = name; this.el.chordQueueDiv.appendChild(pill); }); };
ProAnthemApp.prototype.startRecording = async function() { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); this.mediaRecorder = new MediaRecorder(stream); this.mediaRecorder.ondataavailable = event => { this.audioChunks.push(event.data); }; this.mediaRecorder.onstop = this.handleSaveRecording.bind(this); this.audioChunks = []; this.mediaRecorder.start(); this.el.recordBtn.textContent = 'Recording...'; this.el.recordBtn.disabled = true; this.el.stopBtn.disabled = false; this.el.recordingStatus.textContent = 'Recording...'; } catch (err) { this.setStatus('Microphone access denied.', true); } };
ProAnthemApp.prototype.stopRecording = function() { if (this.mediaRecorder) this.mediaRecorder.stop(); this.el.recordBtn.textContent = 'Record'; this.el.recordBtn.disabled = false; this.el.stopBtn.disabled = true; this.el.recordingStatus.textContent = 'Processing...'; };
ProAnthemApp.prototype.handleSaveRecording = async function() { const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' }); const formData = new FormData(); formData.append('file', audioBlob); formData.append('upload_preset', this.CONSTANTS.CLOUDINARY_UPLOAD_PRESET); const url = `https://api.cloudinary.com/v1_1/${this.CONSTANTS.CLOUDINARY_CLOUD_NAME}/video/upload`; try { const response = await fetch(url, { method: 'POST', body: formData }); if (!response.ok) throw new Error('Upload failed'); const data = await response.json(); this.songData.audio_url = data.secure_url; await this.handleSave(); this.el.recordingStatus.textContent = 'Recording saved.'; document.getElementById('audioPlayerContainer').classList.remove('hidden'); document.getElementById('audioPlayer').src = data.secure_url; } catch (error) { this.setStatus('Failed to upload recording.', true); this.el.recordingStatus.textContent = ''; } };
ProAnthemApp.prototype.handleSongBlockClick = function(e) { const blockEl = e.target.closest('.song-block'); if (!blockEl) return; const blockId = blockEl.dataset.blockId; const block = this.songData.song_blocks.find(b => b.id === blockId); if (e.target.classList.contains('lyrics-block') && this.chordQueue.length > 0) { e.preventDefault(); const textarea = e.target; const chordToPlace = this.chordQueue[this.chordQueueIndex]; const t = `[${chordToPlace}]`; const p = textarea.selectionStart; textarea.value = textarea.value.slice(0, p) + t + textarea.value.slice(p); textarea.focus(); const newPos = p + t.length; textarea.setSelectionRange(newPos, newPos); this.chordQueueIndex = (this.chordQueueIndex + 1) % this.chordQueue.length; this.updateBlockData(blockId, 'content', textarea.value); this.renderChordQueue(); } else if (e.target.dataset.action === 'delete') { if (confirm('Are you sure?')) { this.songData.song_blocks = this.songData.song_blocks.filter(b => b.id !== blockId && b.originalId !== blockId); this.renderSongBlocks(); } } else if (e.target.dataset.action === 'rename') { const newLabel = prompt('Enter new label:', block.label); if (newLabel) { block.label = newLabel; this.renderSongBlocks(); } } else if (e.target.dataset.action === 'edit-tab') { const button = e.target; block.editMode = !block.editMode; button.textContent = block.editMode ? 'Done Editing' : 'Edit'; button.classList.toggle('btn-secondary'); button.classList.toggle('btn-edit-mode'); if (!block.editMode && this.selectedNote.blockId === blockId) { this.selectedNote = {}; this.drawNotesOnFretboard(blockId); } } };
ProAnthemApp.prototype.handleDeleteNote = function(e) { if (!this.selectedNote.blockId || this.selectedNote.noteIndex === null) return; if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); const block = this.songData.song_blocks.find(b => b.id === this.selectedNote.blockId); if (block?.data?.notes?.[this.selectedNote.noteIndex]) { block.data.notes.splice(this.selectedNote.noteIndex, 1); const oldBlockId = this.selectedNote.blockId; this.selectedNote = {}; this.drawNotesOnFretboard(oldBlockId); this.renderPreview(); } } };
ProAnthemApp.prototype.confirmFretSelection = function() { const { blockId, string, position } = this.fretSelectionContext; const fret = parseInt(this.el.fretNumberSelector.value, 10); const block = this.songData.song_blocks.find(b => b.id === blockId); if(block && string !== null && position !== null && fret >= 0) { const totalOffset = (this.CONSTANTS.TUNINGS[this.songData.tuning]?.offset ?? 0) + this.songData.capo; if (!block.data) block.data = { notes: [] }; block.data.notes.push({ string, fret: fret + totalOffset, position }); this.drawNotesOnFretboard(blockId); this.renderPreview(); } this.el.fretSelectionModal.classList.add('hidden'); };
ProAnthemApp.prototype.handleAddBlockClick = function(e) { const target = e.target; if (target.id === 'insert-ref-btn') { document.getElementById('ref-dropdown').classList.toggle('hidden'); } else if (target.closest('#ref-dropdown')) { const originalId = target.dataset.originalId; const originalBlock = this.songData.song_blocks.find(b => b.id === originalId); if(originalBlock) { this.songData.song_blocks.push({ id: `block_${Date.now()}`, type: 'reference', label: `Reference to ${originalBlock.label}`, originalId: originalId }); this.renderSongBlocks(); } document.getElementById('ref-dropdown').classList.add('hidden'); } else if (target.dataset.action === 'add') { const type = target.dataset.type; const baseLabel = target.textContent.trim().replace('+', '').trim(); const count = this.songData.song_blocks.filter(b => b.label.startsWith(baseLabel)).length + 1; const label = `${baseLabel} ${count}`; const newBlock = { id: `block_${Date.now()}`, type, label, height: 100 }; if (type === 'lyrics' || type === 'drum_tab') newBlock.content = ''; if (type === 'tab') { newBlock.data = { notes: [] }; newBlock.strings = 6; newBlock.editMode = false; } this.songData.song_blocks.push(newBlock); this.renderSongBlocks(); } };
ProAnthemApp.prototype.handleAddSetlistNote = function() { const noteText = this.el.newSetlistNoteInput.value.trim(); if (!noteText) return; const noteId = `note_${Date.now()}`; const li = document.createElement('li'); li.className = 'flex justify-between items-center p-2 bg-gray-750 border border-dashed border-gray-600 rounded cursor-grab'; li.dataset.itemId = noteId; li.dataset.itemType = 'note'; const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`; li.innerHTML = `<span>${gripHandle}<em class="text-indigo-300">${noteText}</em></span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button>`; this.el.songsInSetlist.appendChild(li); this.el.newSetlistNoteInput.value = ''; this.saveSetlistOrderAndNotes(); };
ProAnthemApp.prototype.handleDeleteAudio = async function() { if (confirm('Are you sure you want to permanently delete this voice memo?')) { this.songData.audio_url = null; try { await this.handleSave(); document.getElementById('audioPlayerContainer').classList.add('hidden'); document.getElementById('audioPlayer').src = ''; this.setStatus('Recording deleted.', false); } catch (error) { this.setStatus(`Failed to delete recording: ${error.message}`, true); } } };

// --- END OF FILE public/js/app.js ---
