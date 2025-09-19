// --- START OF FILE public/js/modules/fretboardController.js ---

import * as Fretboard from './fretboard.js';
import { getSongData, updateBlockData } from './songDataManager.js';
import { getUserPayload } from '/js/auth.js';

let selectedNote = {};
let isDraggingNote = false;
let fretSelectionContext = {};
let renderCallback = () => {};

const CONSTANTS = {
    TUNINGS: { E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, DROP_C: { name: "Drop C", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'C'] } },
    STRING_CONFIG: { 6: { height: 180, stringSpacing: 28 }, 7: { height: 210, stringSpacing: 28 }, 8: { height: 240, stringSpacing: 28 } },
    FRETBOARD_CONFIG: { frets: 24, width: 8000, nutWidth: 15, fretSpacing: 80, dotFrets: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24], dotRadius: 5, noteRadius: 11 },
};

export function init(onUpdate) {
    renderCallback = onUpdate;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleDeleteNote);
    
    document.getElementById('add-fret-btn').addEventListener('click', confirmFretSelection);
    document.getElementById('cancel-fret-btn').addEventListener('click', () => {
        document.getElementById('fret-selection-modal').classList.add('hidden');
    });
}

export function drawFretboard(blockId) {
    const songData = getSongData();
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (!block || block.type !== 'tab') return;

    Fretboard.drawFretboard(
        blockId, block.strings, CONSTANTS.TUNINGS, CONSTANTS.STRING_CONFIG,
        CONSTANTS.FRETBOARD_CONFIG, drawNotesOnFretboard, attachFretboardListeners
    );
}

function drawNotesOnFretboard(blockId) {
    const songData = getSongData();
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (!block || block.type !== 'tab') return;
    
    Fretboard.drawNotesOnFretboard(
        blockId, block.data?.notes, selectedNote, block.strings,
        songData.tuning, songData.capo, CONSTANTS.TUNINGS,
        CONSTANTS.STRING_CONFIG, CONSTANTS.FRETBOARD_CONFIG
    );
}

function attachFretboardListeners(svgEl) {
    svgEl.addEventListener('click', handleFretboardClick);
    svgEl.addEventListener('mousedown', handleNoteMouseDown);
}

function handleFretboardClick(e) {
    const svg = e.currentTarget;
    const blockId = svg.id.replace('fretboard-svg-', '');
    const songData = getSongData();
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const user = getUserPayload();
    const canEditTabs = user && user.permissions && user.permissions.can_use_setlists;

    if (!block.editMode) {
        if (canEditTabs) {
            block.editMode = true;
            renderCallback();
            return;
        } else {
            return;
        }
    }

    if (e.target.classList.contains('fretboard-note')) return;

    if (selectedNote.blockId) {
        const oldBlockId = selectedNote.blockId;
        selectedNote = {};
        drawNotesOnFretboard(oldBlockId);
        document.getElementById('notation-palette').classList.add('hidden');
    }

    const clickData = Fretboard.getFretFromClick(e, svg, block.strings, CONSTANTS.STRING_CONFIG, CONSTANTS.FRETBOARD_CONFIG);
    if (clickData) {
        fretSelectionContext = { blockId, string: clickData.string, position: clickData.position };
        const modal = document.getElementById('fret-selection-modal');
        modal.style.left = `${e.clientX + 10}px`;
        modal.style.top = `${e.clientY + 10}px`;
        const selector = document.getElementById('fret-number-selector');
        selector.innerHTML = [...Array(CONSTANTS.FRETBOARD_CONFIG.frets + 1).keys()].map(f => `<option value="${f}">${f}</option>`).join('');
        selector.value = clickData.fret;
        modal.classList.remove('hidden');
        selector.focus();
    }
}

function handleNoteMouseDown(e) {
    if (!e.target.classList.contains('fretboard-note')) return;
    const svg = e.currentTarget;
    const blockId = svg.id.replace('fretboard-svg-', '');
    const songData = getSongData();
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (!block || !block.editMode) return;

    const noteIndex = parseInt(e.target.dataset.noteIndex, 10);
    if (selectedNote.blockId === blockId && selectedNote.noteIndex === noteIndex) {
        isDraggingNote = true;
    } else {
        selectedNote = { blockId, noteIndex };
    }
    drawNotesOnFretboard(blockId);

    const palette = document.getElementById('notation-palette');
    const noteElement = e.target;
    const noteRect = noteElement.getBoundingClientRect();
    palette.style.left = `${noteRect.right + 10}px`;
    palette.style.top = `${noteRect.top}px`;
    palette.classList.remove('hidden');
}

function confirmFretSelection() {
    const { blockId, string, position } = fretSelectionContext;
    const fret = parseInt(document.getElementById('fret-number-selector').value, 10);
    const songData = getSongData();
    const block = songData.song_blocks.find(b => b.id === blockId);

    if (block && string !== null && position !== null && fret >= 0) {
        if (!block.data) block.data = {};
        if (!block.data.notes) block.data.notes = [];
        
        // Push the new note to the block's data
        block.data.notes.push({ string, fret, position });

        // THIS IS THE CRITICAL FIX:
        // Immediately update the central song data manager with the entire block.data object.
        updateBlockData(blockId, 'data', block.data);
        
        // Then, trigger a full re-render of the song UI.
        renderCallback(); 
    }
    document.getElementById('fret-selection-modal').classList.add('hidden');
}

function handleDeleteNote(e) {
    if (!selectedNote.blockId || selectedNote.noteIndex === undefined) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const songData = getSongData();
        const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
        if (block?.data?.notes?.[selectedNote.noteIndex]) {
            block.data.notes.splice(selectedNote.noteIndex, 1);
            
            const oldBlockId = selectedNote.blockId;
            selectedNote = {};
            document.getElementById('notation-palette').classList.add('hidden');
            
            // CRITICAL FIX: Update the central data and re-render.
            updateBlockData(oldBlockId, 'data', block.data);
            renderCallback();
        }
    }
}

function handleMouseMove(e) {
    if (isDraggingNote && selectedNote.blockId) {
        const songData = getSongData();
        const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
        const note = block?.data?.notes[selectedNote.noteIndex];
        if (note) {
            const svg = document.getElementById(`fretboard-svg-${selectedNote.blockId}`);
            const clickData = Fretboard.getFretFromClick(e, svg, block.strings, CONSTANTS.STRING_CONFIG, CONSTANTS.FRETBOARD_CONFIG);
            if (clickData) {
                note.position = clickData.position;
                note.string = clickData.string;
                drawNotesOnFretboard(selectedNote.blockId); // Just redraw notes for smooth dragging
            }
        }
    }
}

function handleMouseUp() {
    if (isDraggingNote) {
        isDraggingNote = false;
        const songData = getSongData();
        const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
        if (block) {
            // CRITICAL FIX: Update central data and re-render after drag is finished.
            updateBlockData(selectedNote.blockId, 'data', block.data);
            renderCallback();
        }
    }
}

export function resetSelection() {
    if (selectedNote.blockId) {
        const oldBlockId = selectedNote.blockId;
        selectedNote = {};
        drawNotesOnFretboard(oldBlockId);
        document.getElementById('notation-palette').classList.add('hidden');
    }
}

export function getSelectedNote() {
    return selectedNote;
}
