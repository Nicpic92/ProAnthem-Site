// --- START OF FILE public/js/modules/songDataManager.js ---

import * as api from '../api.js';
import * as drumEditor from './drumEditor.js';

let songData = {};

/**
 * Returns the current song data object.
 * @returns {object} The current song data.
 */
export function getSongData() {
    return songData;
}

/**
 * Creates the initial data structure for the demo song.
 */
function initializeDemoSongData() {
    songData = { 
        id: 'demo-song', title: 'The ProAnthem Feature Tour', artist: 'The Dev Team', audio_url: null, duration: '4:15',
        song_blocks: [
            { id: 'block_1', type: 'lyrics', label: 'Lyrics & Chords', content: '[G]Just type your lyrics [D]in this space,\nPut [Em]chords in brackets, [C]right in place.\nThe [G]preview updates, [D]as you go,\nA [C]perfect layout for your [G]show.', height: 140 },
            { id: 'block_2', type: 'tab', label: 'Guitar Riff Example', strings: 6, data: { notes: [{string: 3, fret: 5, position: 200}, {string: 3, fret: 7, position: 350, notation: 'h'}, {string: 2, fret: 5, position: 500}, {string: 2, fret: 7, position: 650, notation: 'p'}]}, editMode: false }
        ],
        tuning: 'E_STANDARD', capo: 0, transpose: 0
    };
}

/**
 * Creates the data structure for a blank new song.
 */
function initializeNewSongData() {
    // NEW: Start with a helpful lyrics block instead of a drum tab.
    const welcomeContent = 
`[Verse 1]
[G]This is where your lyrics go.
Put chords in [C]brackets, right where they should [G]be.
The [D]live preview below will update as you [G]type.`;

    songData = { 
        id: null, title: '', artist: '', duration: '', audio_url: null, 
        song_blocks: [{ 
            id: `block_${Date.now()}`, 
            type: 'lyrics', 
            label: 'Verse 1', 
            content: welcomeContent,
            height: 120 
        }], 
        tuning: 'E_STANDARD', capo: 0, transpose: 0 
    };
}

/**
 * Loads the initial song, either the first from the user's library or a new blank one.
 * @returns {Promise<void>}
 */
export async function loadInitialSong() {
    try {
        const songs = await api.getSheets();
        if (songs && songs.length > 0) {
            await loadSong(songs[0].id);
        } else {
            initializeNewSongData();
        }
    } catch (e) {
        initializeNewSongData();
        throw new Error('Could not load songs. Starting new.');
    }
}

/**
 * Loads a specific song from the API.
 * @param {string | null} id - The ID of the song to load. If null or 'new', creates a new song.
 * @returns {Promise<object>} The loaded song data.
 */
export async function loadSong(id) {
    if (!id || id === 'new') {
        initializeNewSongData();
        return songData;
    }
    const data = await api.getSheet(id);
    songData = { 
        id: data.id, 
        title: data.title || '', 
        artist: data.artist || '', 
        duration: data.duration, 
        audio_url: data.audio_url, 
        song_blocks: Array.isArray(data.song_blocks) ? data.song_blocks : [], 
        tuning: data.tuning ?? 'E_STANDARD', 
        capo: data.capo ?? 0, 
        transpose: data.transpose ?? 0 
    };
    return songData;
}

/**
 * Saves the current song data to the API.
 * @param {boolean} isDemo - Whether the app is in demo mode.
 * @returns {Promise<object>} The saved song data.
 */
export async function saveSong(isDemo) {
    if (isDemo) {
        const hasContent = songData.song_blocks.some(b => (b.content && b.content.trim() !== '') || (b.data && b.data.notes && b.data.notes.length > 0));
        if (!hasContent && !songData.title) {
            alert("Please add a title or some content before saving!");
            return null;
        }
        alert("Let's save your work! We'll take you to the signup page. Your song will be waiting for you in your new account.");
        localStorage.setItem('pendingSong', JSON.stringify(songData));
        window.location.href = '/pricing.html';
        return null;
    }

    const savedSong = songData.id ? await api.updateSheet(songData.id, songData) : await api.createSheet(songData);
    songData.id = savedSong.id;
    return savedSong;
}

/**
 * Deletes the current song via the API.
 * @returns {Promise<void>}
 */
export async function deleteSong() {
    if (!songData.id) {
        throw new Error("Cannot delete an unsaved song.");
    }
    await api.deleteSheet(songData.id);
    initializeNewSongData();
}

/**
 * Updates a field in the main songData object.
 * @param {string} field - The top-level field to update (e.g., 'title', 'capo').
 * @param {*} value - The new value.
 */
export function updateSongField(field, value) {
    if (songData.hasOwnProperty(field)) {
        songData[field] = value;
    }
}

/**
 * Updates a property of a specific song block.
 * @param {string} blockId - The ID of the block.
 * @param {string | null} field - The field within the block to update (e.g., 'content').
 * @param {*} value - The new value for the field.
 * @param {number | null} height - An optional new height for the block.
 */
export function updateBlockData(blockId, field, value, height) {
    const block = songData.song_blocks.find(b => b.id === blockId);
    if (block) {
        if (field !== null) block[field] = value;
        if (height !== null) block.height = height;
    }
}

/**
 * Sets the entire song_blocks array, typically after a reorder or import.
 * @param {Array<object>} newBlocks - The new array of song blocks.
 */
export function setSongBlocks(newBlocks) {
    songData.song_blocks = newBlocks;
}

/**
 * Replaces the current song data with new data, typically from an import.
 * @param {object} newData - The complete new song data object.
 */
export function replaceSongData(newData) {
    songData = newData;
}


// Initialize demo data if needed by other modules on first load
initializeDemoSongData();
export const DEMO_SONG_DATA = songData;
