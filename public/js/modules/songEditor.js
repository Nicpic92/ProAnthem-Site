// --- START OF FILE public/js/modules/songEditor.js ---

import * as api from '../api.js';
import * as UI from './ui.js';
import * as Fretboard from './fretboard.js';

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
    TUNINGS: { E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, DROP_C: { name: "Drop 
