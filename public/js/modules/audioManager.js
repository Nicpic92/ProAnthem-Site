// --- START OF FILE public/js/modules/audioManager.js ---

import { setStatus } from './ui.js';

const CLOUDINARY_CLOUD_NAME = "dawbku2eq";
const CLOUDINARY_UPLOAD_PRESET = "project-anthem-unsigned";

let mediaRecorder = null;
let audioChunks = [];
let onRecordingFinished = null;

// DOM elements that this module controls
const el = {
    recordBtn: null,
    stopBtn: null,
    recordingStatus: null,
    statusMessage: null
};

/**
 * Initializes the audio manager and caches necessary DOM elements.
 * @param {function(string):void} onFinishedCallback - A function to call with the new audio URL when recording is complete.
 */
export function init(onFinishedCallback) {
    onRecordingFinished = onFinishedCallback;

    el.recordBtn = document.getElementById('recordBtn');
    el.stopBtn = document.getElementById('stopBtn');
    el.recordingStatus = document.getElementById('recordingStatus');
    el.statusMessage = document.getElementById('statusMessage');

    el.recordBtn?.addEventListener('click', startRecording);
    el.stopBtn?.addEventListener('click', stopRecording);
}

/**
 * Starts the audio recording process.
 */
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = handleUploadRecording;

        audioChunks = [];
        mediaRecorder.start();
        
        updateUIForRecording();

    } catch (err) {
        setStatus(el.statusMessage, 'Microphone access denied.', true);
    }
}

/**
 * Stops the current audio recording.
 */
function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        updateUIForProcessing();
    }
}

/**
 * Handles the upload of the recorded audio blob to Cloudinary.
 */
async function handleUploadRecording() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
    
    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        if (!response.ok) {
            throw new Error(`Upload failed with status: ${response.status}`);
        }
        const data = await response.json();
        
        if (onRecordingFinished) {
            onRecordingFinished(data.secure_url);
        }
        
        updateUIForIdle('Recording saved.');

    } catch (error) {
        console.error('Failed to upload recording:', error);
        setStatus(el.statusMessage, `Failed to upload recording: ${error.message}`, true);
        updateUIForIdle('');
    }
}

// --- UI Update Functions ---

function updateUIForRecording() {
    if (el.recordBtn) {
        el.recordBtn.textContent = 'Recording...';
        el.recordBtn.disabled = true;
    }
    if (el.stopBtn) {
        el.stopBtn.disabled = false;
    }
    if (el.recordingStatus) {
        el.recordingStatus.textContent = 'Recording...';
    }
}

function updateUIForProcessing() {
    if (el.recordBtn) {
        el.recordBtn.textContent = 'Record';
        el.recordBtn.disabled = true; // Keep disabled while processing
    }
    if (el.stopBtn) {
        el.stopBtn.disabled = true;
    }
    if (el.recordingStatus) {
        el.recordingStatus.textContent = 'Processing...';
    }
}

function updateUIForIdle(statusText = '') {
    if (el.recordBtn) {
        el.recordBtn.textContent = 'Record';
        el.recordBtn.disabled = false;
    }
    if (el.stopBtn) {
        el.stopBtn.disabled = true;
    }
    if (el.recordingStatus) {
        el.recordingStatus.textContent = statusText;
    }
}
