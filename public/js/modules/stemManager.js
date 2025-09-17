// --- START OF FILE public/js/modules/stemManager.js ---

import { getSongStems, createSongStem, deleteSongStem } from '../api.js';

const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME'; // IMPORTANT: Replace with your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UNSIGNED_PRESET'; // IMPORTANT: Replace with your unsigned preset name

let currentSongId = null;
let stemAudioElements = []; // To hold the <audio> elements for playback control

// DOM Elements
const el = {
    modal: document.getElementById('stems-modal'),
    modalSongTitle: document.getElementById('stems-modal-song-title'),
    uploadForm: document.getElementById('stem-upload-form'),
    instrumentInput: document.getElementById('stem-instrument-name'),
    fileInput: document.getElementById('stem-file-input'),
    uploadStatus: document.getElementById('stem-upload-status'),
    currentStemsList: document.getElementById('current-stems-list'),
    closeModalBtn: document.getElementById('close-stems-modal-btn'),
    mixerContainer: document.getElementById('stem-mixer-container'),
    tracksContainer: document.getElementById('stem-tracks-container')
};

export function init() {
    el.uploadForm.addEventListener('submit', handleUpload);
    el.closeModalBtn.addEventListener('click', closeModal);
}

export function openModal(song) {
    if (!song || !song.id) {
        alert('Please save the song before managing stems.');
        return;
    }
    currentSongId = song.id;
    el.modalSongTitle.textContent = song.title;
    el.uploadForm.reset();
    el.uploadStatus.textContent = '';
    el.modal.classList.remove('hidden');
    loadStemsForModal();
}

function closeModal() {
    el.modal.classList.add('hidden');
    loadStemsForMixer(currentSongId); // Refresh the mixer when closing
}

async function loadStemsForModal() {
    el.currentStemsList.innerHTML = '<p>Loading...</p>';
    try {
        const stems = await getSongStems(currentSongId);
        el.currentStemsList.innerHTML = '';
        if (stems.length === 0) {
            el.currentStemsList.innerHTML = '<p class="text-gray-400">No stems uploaded yet.</p>';
            return;
        }
        stems.forEach(stem => {
            const stemEl = document.createElement('div');
            stemEl.className = 'flex justify-between items-center p-2 bg-gray-800 rounded';
            stemEl.innerHTML = `<span>${stem.instrument_name}</span><button class="btn btn-danger btn-sm">&times;</button>`;
            stemEl.querySelector('button').addEventListener('click', async () => {
                if (confirm(`Delete stem "${stem.instrument_name}"?`)) {
                    await deleteSongStem(stem.id);
                    loadStemsForModal();
                }
            });
            el.currentStemsList.appendChild(stemEl);
        });
    } catch (error) {
        el.currentStemsList.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
    }
}

async function handleUpload(e) {
    e.preventDefault();
    const instrumentName = el.instrumentInput.value.trim();
    const file = el.fileInput.files[0];

    if (!instrumentName || !file) {
        el.uploadStatus.textContent = 'Please provide an instrument name and select a file.';
        return;
    }

    el.uploadStatus.textContent = 'Uploading to cloud...';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Cloudinary upload failed.');
        
        const data = await response.json();
        
        el.uploadStatus.textContent = 'Saving reference...';
        await createSongStem({
            song_id: currentSongId,
            instrument_name: instrumentName,
            file_url: data.secure_url
        });
        
        el.uploadStatus.textContent = 'Upload successful!';
        el.uploadForm.reset();
        loadStemsForModal();

    } catch (error) {
        el.uploadStatus.textContent = `Error: ${error.message}`;
    }
}

export async function loadStemsForMixer(songId) {
    // Clean up previous audio elements
    stemAudioElements.forEach(audio => audio.pause());
    stemAudioElements = [];
    el.tracksContainer.innerHTML = '';

    if (!songId) {
        el.mixerContainer.classList.add('hidden');
        return;
    }

    try {
        const stems = await getSongStems(songId);
        if (stems.length > 0) {
            el.mixerContainer.classList.remove('hidden');
            stems.forEach(stem => {
                const trackEl = document.createElement('div');
                trackEl.className = 'flex items-center gap-4';
                
                const audio = new Audio(stem.file_url);
                audio.loop = true;
                stemAudioElements.push(audio);

                trackEl.innerHTML = `
                    <label class="w-32 truncate">${stem.instrument_name}</label>
                    <input type="range" min="0" max="1" step="0.01" value="1" class="flex-grow">
                    <button class="btn btn-sm btn-secondary w-16">Play</button>
                `;
                
                const volumeSlider = trackEl.querySelector('input[type="range"]');
                const playButton = trackEl.querySelector('button');

                volumeSlider.addEventListener('input', (e) => audio.volume = e.target.value);
                playButton.addEventListener('click', () => {
                    const isPlaying = playButton.textContent === 'Pause';
                    if (isPlaying) {
                        audio.pause();
                        playButton.textContent = 'Play';
                    } else {
                        audio.play();
                        playButton.textContent = 'Pause';
                    }
                });

                el.tracksContainer.appendChild(trackEl);
            });
        } else {
            el.mixerContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load stems for mixer:', error);
        el.mixerContainer.classList.add('hidden');
    }
}
// --- END OF FILE public/js/modules/stemManager.js ---
