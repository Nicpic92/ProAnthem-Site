// --- START OF FILE public/js/modules/historyManager.js ---

import * as api from '../api.js';
import * as UI from './ui.js';
import { reloadSong } from './songEditor.js';

let isDemo = false;
let selectedVersionData = null;
let currentSongData = null;
let renderPreviewCallback = null;
let renderTransposedTabCallback = null;

const el = {};

function cacheDOMElements() {
    el.historyModal = document.getElementById('history-modal');
    el.closeHistoryModalBtn = document.getElementById('close-history-modal-btn');
    el.closeHistoryModalBtn2 = document.getElementById('close-history-modal-btn-2');
    el.historyModalTitle = document.getElementById('history-modal-title');
    el.historyVersionList = document.getElementById('history-version-list');
    el.historyPreviewPane = document.getElementById('history-preview-pane');
    el.restoreVersionBtn = document.getElementById('restore-version-btn');
}

export function init(isDemoMode) {
    isDemo = isDemoMode;
    cacheDOMElements();
    attachEventListeners();
}

function attachEventListeners() {
    el.closeHistoryModalBtn?.addEventListener('click', () => el.historyModal.classList.add('hidden'));
    el.closeHistoryModalBtn2?.addEventListener('click', () => el.historyModal.classList.add('hidden'));
    el.restoreVersionBtn?.addEventListener('click', handleRestoreVersion);
}

export async function openHistoryModal(songData, previewCallback, reloadCallback, transposedTabCallback) {
    if (isDemo || !songData.id) {
        alert("Version history is only available for saved songs.");
        return;
    }

    currentSongData = songData;
    renderPreviewCallback = previewCallback;
    renderTransposedTabCallback = transposedTabCallback;

    el.historyModalTitle.textContent = `Version History for "${currentSongData.title}"`;
    el.historyVersionList.innerHTML = '<li>Loading...</li>';
    el.historyPreviewPane.innerHTML = '<p class="text-gray-400">Select a version to preview its content.</p>';
    el.restoreVersionBtn.disabled = true;
    selectedVersionData = null;
    el.historyModal.classList.remove('hidden');

    try {
        const versions = await api.getVersions(currentSongData.id);
        el.historyVersionList.innerHTML = '';
        if (versions.length === 0) {
            el.historyVersionList.innerHTML = '<li>No previous versions found.</li>';
            return;
        }

        versions.forEach(version => {
            const li = document.createElement('li');
            li.className = 'p-2 rounded-md hover:bg-gray-700 cursor-pointer';
            li.dataset.versionId = version.id;
            const versionDate = new Date(version.created_at);
            li.innerHTML = `
                <p class="font-bold">Version ${version.version_number}</p>
                <p class="text-sm text-gray-400">Saved by ${version.updated_by_email || 'Unknown'}</p>
                <p class="text-xs text-gray-500">${versionDate.toLocaleString()}</p>
            `;
            li.addEventListener('click', () => selectVersion(version.id, li));
            el.historyVersionList.appendChild(li);
        });
    } catch (error) {
        el.historyVersionList.innerHTML = `<li>Error: ${error.message}</li>`;
    }
}

async function selectVersion(versionId, listItemElement) {
    el.historyVersionList.querySelectorAll('li').forEach(li => li.classList.remove('bg-blue-600/50'));
    listItemElement.classList.add('bg-blue-600/50');

    el.historyPreviewPane.innerHTML = 'Loading preview...';
    el.restoreVersionBtn.disabled = true;

    try {
        const versionData = await api.getVersion(currentSongData.id, versionId);
        selectedVersionData = versionData;
        
        const renderFunc = (block) => renderTransposedTabCallback(block, versionData);
        UI.renderPreview(el.historyPreviewPane, versionData.song_blocks, renderFunc);

        el.restoreVersionBtn.disabled = false;
    } catch (error) {
        el.historyPreviewPane.innerHTML = `<p class="text-red-500">Error loading preview: ${error.message}</p>`;
    }
}

async function handleRestoreVersion() {
    if (!selectedVersionData) {
        alert("Please select a version to restore.");
        return;
    }

    if (!confirm(`Are you sure you want to restore Version ${selectedVersionData.version_number}?\n\nThis will overwrite the current version of the song. The current version will be saved as a new entry in the history.`)) {
        return;
    }

    try {
        const statusMessageEl = document.getElementById('statusMessage');
        UI.setStatus(statusMessageEl, 'Restoring version...');
        
        await api.updateSheet(currentSongData.id, {
            title: selectedVersionData.title,
            artist: selectedVersionData.artist,
            audio_url: selectedVersionData.audio_url,
            song_blocks: selectedVersionData.song_blocks,
            tuning: selectedVersionData.tuning,
            capo: selectedVersionData.capo,
            transpose: selectedVersionData.transpose,
            duration: selectedVersionData.duration
        });

        el.historyModal.classList.add('hidden');
        UI.setStatus(statusMessageEl, 'Song restored successfully!', false);
        
        reloadSong(currentSongData.id);

    } catch (error) {
        UI.setStatus(document.getElementById('statusMessage'), `Restore failed: ${error.message}`, true);
    }
}
