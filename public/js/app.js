// --- START OF FILE public/js/app.js ---

// This flag checks which page is running the script
const isDemoMode = window.location.pathname.includes('Demo.html');

// We'll replace the old DOMContentLoaded listener with this one
document.addEventListener('DOMContentLoaded', () => {
    if (isDemoMode) {
        // In demo mode, we just run the initializer directly
        initializeApp();
    } else {
        // In the live app, we must check for access first
        // The checkAccess function is in auth.js and will handle redirects if needed
        if (checkAccess()) {
            const user = getUserPayload();
            if (user && user.force_reset) {
                document.getElementById('password-reset-modal').classList.remove('hidden');
                document.getElementById('password-reset-form').addEventListener('submit', handlePasswordReset);
            } else {
                initializeApp();
            }
        }
    }
});

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
        await apiRequest('band/change-password', { currentPassword, newPassword }, 'POST');
        alert('Password updated successfully! You can now use the tool.');
        document.getElementById('password-reset-modal').classList.add('hidden');
        initializeApp();
    } catch (error) {
        errorEl.textContent = error.message;
    }
}

function initializeApp() {
    // Demo-mode specific DOM elements might not exist in live app, and vice versa.
    // We use optional chaining (?.) or check for existence to prevent errors.
    const resetDemoBtn = document.getElementById('resetDemoBtn');
    if (isDemoMode && resetDemoBtn) {
        resetDemoBtn.addEventListener('click', () => { if (confirm('Are you sure you want to reset the demo? All your changes will be lost.')) initializeDemoSong(); });
    }
    
    const CLOUDINARY_CLOUD_NAME = "dawbku2eq";
    const CLOUDINARY_UPLOAD_PRESET = "project-anthem-unsigned";
    let songData = { id: null, title: '', artist: '', audio_url: null, song_blocks: [], tuning: 'E_STANDARD', capo: 0, transpose: 0 };
    let chordQueue = [], chordQueueIndex = 0, lastFocusedLyricsBlock = null, mediaRecorder, audioChunks = [];
    let fretSelectionContext = { blockId: null, string: null, position: null }, selectedNote = { blockId: null, noteIndex: null };
    let activeResize = { element: null, startY: 0, startHeight: 0 }, isDraggingNote = false;

    const titleInput = document.getElementById('titleInput'), artistInput = document.getElementById('artistInput'), songBlocksContainer = document.getElementById('song-blocks-container'), addBlockButtonsContainer = document.getElementById('add-block-buttons'), livePreview = document.getElementById('livePreview'), tuningSelector = document.getElementById('tuningSelector'), capoFretInput = document.getElementById('capoFretInput'), songSelector = document.getElementById('songSelector'), saveBtn = document.getElementById('saveBtn'), deleteBtn = document.getElementById('deleteBtn'), statusMessage = document.getElementById('statusMessage'), chordPalette = document.querySelector('#sidebar #chordPalette'), newChordInput = document.querySelector('#sidebar #newChordInput'), addChordBtn = document.querySelector('#sidebar #addChordBtn'), transposeDownBtn = document.getElementById('transposeDownBtn'), transposeUpBtn = document.getElementById('transposeUpBtn'), transposeStatus = document.getElementById('transposeStatus'), chordQueueDiv = document.getElementById('chordQueue'), clearQueueBtn = document.getElementById('clearQueueBtn'), setlistBtn = document.getElementById('setlistBtn'), recordBtn = document.getElementById('recordBtn'), stopBtn = document.getElementById('stopBtn'), recordingStatus = document.getElementById('recordingStatus'), deleteAudioBtn = document.getElementById('deleteAudioBtn');
    const setlistModal = document.getElementById('setlistModal'), closeSetlistModalBtn = document.getElementById('closeSetlistModalBtn'), setlistSelector = document.getElementById('setlistSelector'), createSetlistBtn = document.getElementById('createSetlistBtn'), addSongToSetlistBtn = document.getElementById('addSongToSetlistBtn'), printSetlistBtn = document.getElementById('printSetlistBtn'), newSetlistInput = document.getElementById('newSetlistInput'), songsInSetlist = document.getElementById('songsInSetlist'), currentSetlistTitle = document.getElementById('currentSetlistTitle'), setlistDetailsSection = document.getElementById('setlistDetailsSection'), saveSetlistDetailsBtn = document.getElementById('saveSetlistDetailsBtn'), deleteSetlistBtn = document.getElementById('deleteSetlistBtn'), printDrummerSetlistBtn = document.getElementById('printDrummerSetlistBtn');
    const fretSelectionModal = document.getElementById('fret-selection-modal'), fretNumberSelector = document.getElementById('fret-number-selector'), addFretBtn = document.getElementById('add-fret-btn'), cancelFretBtn = document.getElementById('cancel-fret-btn'), soundingKeyDisplay = document.getElementById('soundingKeyDisplay');
    const importBtn = document.getElementById('importBtn'), importModal = document.getElementById('import-modal'), importTextarea = document.getElementById('import-textarea'), importConfirmBtn = document.getElementById('import-confirm-btn'), importCancelBtn = document.getElementById('import-cancel-btn');
    
    const setlistNoteForm = document.getElementById('setlistNoteForm');
    const newSetlistNoteInput = document.getElementById('newSetlistNoteInput');
    const addSetlistNoteBtn = document.getElementById('addSetlistNoteBtn');
    
    const TUNINGS = { E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, DROP_C: { name: "Drop C", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'C'] } };
    const STRING_CONFIG = { 6: { height: 180, stringSpacing: 28 }, 7: { height: 210, stringSpacing: 28 }, 8: { height: 240, stringSpacing: 28 } };
    const FRETBOARD_CONFIG = { frets: 24, width: 8000, nutWidth: 15, fretSpacing: 80, dotFrets: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24], dotRadius: 5, noteRadius: 11 };
    const sharpScale = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    
    // apiRequest is now defined in auth.js, which is loaded globally.
    const api = {
        getSheets: () => apiRequest('lyric-sheets'),
        getSheet: (id) => apiRequest(`lyric-sheets/${id}`),
        createSheet: (data) => apiRequest('lyric-sheets', data, 'POST'),
        updateSheet: (id, data) => apiRequest(`lyric-sheets/${id}`, data, 'PUT'),
        deleteSheet: (id) => apiRequest(`lyric-sheets/${id}`, null, 'DELETE'),
        getChords: () => apiRequest('chords'),
        createChord: (data) => apiRequest('chords', data, 'POST'),
        getSetlists: () => apiRequest('setlists'),
        getSetlist: (id) => apiRequest(`setlists/${id}`),
        createSetlist: (data) => apiRequest('setlists', data, 'POST'),
        deleteSetlist: (id) => apiRequest(`setlists/${id}`, null, 'DELETE'),
        addSongToSetlist: (setlistId, songId) => apiRequest(`setlists/${setlistId}/songs`, { song_id: songId }, 'POST'),
        removeSongFromSetlist: (setlistId, songId) => apiRequest(`setlists/${setlistId}/songs/${songId}`, null, 'DELETE'),
        updateSetlistDetails: (id, data) => apiRequest(`setlists/${id}`, data, 'PUT'),
        updateSetlistSongOrder: (id, song_ids) => apiRequest(`setlists/${id}/songs`, { song_ids }, 'PUT')
    };
    
    function updateMusicalSettingsUI() { tuningSelector.value = songData.tuning; capoFretInput.value = songData.capo; const steps = songData.transpose; transposeStatus.textContent = steps > 0 ? `+${steps}` : steps; }
    
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
                else metadata.tuning = 'E_STANDARD';
                return false;
            }
            if (line.match(/^Page \d+\/\d+$/i) || line.match(/ultimate-guitar\.com/i)) return false;
            return true;
        });

        const newBlocks = [];
        let currentBlock = null;
        const headerRegex = /^\s*(?:\[([^\]]+)\]|(intro|verse|chorus|bridge|pre-chorus|prechorus|solo|outro|tag|instrumental)[\s\d:]*)\s*$/i;
        const tabLineRegex = /\|.*-|-.*\|/;
        const chordRegexSource = `[A-G][b#]?(?:m|maj|sus|dim|add|aug|m7|7|maj7|m7b5|6|9|11|13)*(?:\\/[A-G][b#]?)?`;
        const chordLineRegex = new RegExp(`^\\s*(${chordRegexSource}(\\s+${chordRegexSource})*\\s*)$`);

        const pushBlock = () => { if (currentBlock) { currentBlock.content = currentBlock.content.trim(); if (currentBlock.content) newBlocks.push(currentBlock); } };
        const createNewBlock = (label, type) => { pushBlock(); const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase().replace('prechorus', 'Pre-Chorus'); currentBlock = { id: `block_${Date.now()}_${newBlocks.length}`, label: capitalizedLabel || 'Section', type: type, content: '', height: 120 }; };

        function bracketInlineChords(line) {
            if (line.includes('[') || line.trim() === '') return line;
            const chordTokenRegex = new RegExp(`\\b(${chordRegexSource})\\b`, 'g');
            return line.replace(chordTokenRegex, '[$1]');
        }

        function mergeChordLyricLines(chordLine, lyricLine) {
            let chords = [];
            const chordFinderRegex = new RegExp(`\\b(${chordRegexSource})\\b`, 'g');
            let match;
            while ((match = chordFinderRegex.exec(chordLine)) !== null) {
                chords.push({ text: `[${match[0]}]`, index: match.index });
            }

            if (chords.length === 0) return lyricLine;
            
            let mergedLine = lyricLine;
            for (let i = chords.length - 1; i >= 0; i--) {
                const chord = chords[i];
                const insertionIndex = Math.min(chord.index, mergedLine.length);
                mergedLine = mergedLine.slice(0, insertionIndex) + chord.text + mergedLine.slice(insertionIndex);
            }
            return mergedLine;
        }
        
        let sectionLines = [];
        for (const line of lines) {
            const headerMatch = line.match(headerRegex);
            if (headerMatch) {
                if (sectionLines.length > 0) processSectionLines(sectionLines);
                sectionLines = [];
                const label = (headerMatch[1] || headerMatch[2] || 'Section').trim();
                createNewBlock(label, 'lyrics');
            } else {
                 sectionLines.push(line);
            }
        }
        if (sectionLines.length > 0) processSectionLines(sectionLines);
        pushBlock();

        function processSectionLines(blockLines) {
            if (!currentBlock) createNewBlock('Verse 1', 'lyrics');
            if (blockLines.every(l => l.trim() === '')) return;

            if (blockLines.some(l => tabLineRegex.test(l))) {
                currentBlock.type = 'tab';
                currentBlock.content += blockLines.join('\n') + '\n\n';
                return;
            }
            
            let processedLines = [];
            for (let i = 0; i < blockLines.length; i++) {
                const currentLine = blockLines[i];
                const nextLine = (i + 1 < blockLines.length) ? blockLines[i + 1] : null;

                if (chordLineRegex.test(currentLine.trim()) && nextLine && nextLine.trim().length > 0 && !chordLineRegex.test(nextLine.trim())) {
                    processedLines.push(mergeChordLyricLines(currentLine, nextLine));
                    i++;
                } else {
                    processedLines.push(bracketInlineChords(currentLine));
                }
            }
            currentBlock.content += processedLines.join('\n') + '\n\n';
        }
        return { blocks: newBlocks, metadata: metadata };
    }

    function updateSoundingKey() { const capoFret = songData.capo || 0; let firstChord = null; for (const block of songData.song_blocks) { if (block.type === 'lyrics' && block.content) { const match = block.content.match(/\[([^\]]+)\]/); if (match) { firstChord = match[1]; break; } } } if (!firstChord) { soundingKeyDisplay.textContent = '-'; return; } const soundingKey = transposeChord(firstChord, capoFret); soundingKeyDisplay.textContent = soundingKey; }
    async function openSetlistManager() { if (document.getElementById('tool-content').classList.contains('hidden')) return; setlistModal.classList.remove('hidden'); await loadSetlists(); handleSetlistSelection(null); }
    async function loadSetlists(selectId = null) { try { const lists = await api.getSetlists(); setlistSelector.innerHTML = '<option value="">-- Select a Setlist --</option>'; lists.forEach(list => { const option = document.createElement('option'); option.value = list.id; option.textContent = list.name; setlistSelector.appendChild(option); }); if (selectId) { setlistSelector.value = selectId; await handleSetlistSelection(selectId); } } catch (error) { setStatus('Failed to load setlists.', true); } }

    async function handleSetlistSelection(setlistId) {
        if (songsInSetlist.sortableInstance) { songsInSetlist.sortableInstance.destroy(); songsInSetlist.sortableInstance = null; }
        if (!setlistId) {
            currentSetlistTitle.textContent = 'Select a setlist';
            setlistDetailsSection.classList.add('hidden');
            setlistNoteForm.classList.add('hidden');
            songsInSetlist.innerHTML = '';
            [addSongToSetlistBtn, printSetlistBtn, printDrummerSetlistBtn, deleteSetlistBtn].forEach(b => b.disabled = true);
            return;
        }
        try {
            const setlist = await api.getSetlist(setlistId);
            currentSetlistTitle.textContent = setlist.name;
            document.getElementById('setlistVenue').value = setlist.venue || '';
            document.getElementById('setlistDate').value = setlist.event_date ? setlist.event_date.split('T')[0] : '';
            document.getElementById('setlistLogoUrl').value = setlist.logo_url || '';
            
            let extraData = { order: [], notes: [] };
            try {
                const notesField = document.getElementById('setlistNotes');
                notesField.value = setlist.notes || ''; 
                const parsedNotes = JSON.parse(setlist.notes || '{}');
                if (parsedNotes.order && Array.isArray(parsedNotes.notes)) extraData = parsedNotes;
            } catch (e) { /* Fails gracefully if notes are plain text */ }

            setlistDetailsSection.classList.remove('hidden');
            setlistNoteForm.classList.remove('hidden');
            songsInSetlist.innerHTML = '';
            
            const allItemsMap = new Map();
            (setlist.songs || []).forEach(s => allItemsMap.set(s.id.toString(), { ...s, type: 'song' }));
            (extraData.notes || []).forEach(n => allItemsMap.set(n.id.toString(), n));
            
            const orderedItems = (extraData.order.length > 0 ? extraData.order : (setlist.songs || []).map(s => s.id))
                .map(id => allItemsMap.get(id.toString())).filter(Boolean);

            orderedItems.forEach(item => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center p-2 bg-gray-700 rounded cursor-grab';
                const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;
                if (item.type === 'song') {
                    li.dataset.itemId = item.id;
                    li.dataset.itemType = 'song';
                    li.innerHTML = `<span>${gripHandle}${item.title} - <em class="text-gray-400">${item.artist}</em></span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button>`;
                } else {
                    li.dataset.itemId = item.id;
                    li.dataset.itemType = 'note';
                    li.classList.add('bg-gray-750', 'border', 'border-dashed', 'border-gray-600');
                    li.innerHTML = `<span>${gripHandle}<em class="text-indigo-300">${item.title}</em></span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button>`;
                }
                songsInSetlist.appendChild(li);
            });

            songsInSetlist.sortableInstance = new Sortable(songsInSetlist, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: () => saveSetlistOrderAndNotes()
            });

            addSongToSetlistBtn.disabled = !songData.id;
            [printSetlistBtn, printDrummerSetlistBtn, deleteSetlistBtn].forEach(b => b.disabled = false);
        } catch (error) {
            setStatus(`Failed to load setlist details: ${error.message}`, true);
        }
    }
    
    async function saveSetlistOrderAndNotes() {
        const setlistId = setlistSelector.value;
        if (!setlistId) return;

        setStatus('Saving setlist...');
        const listItems = Array.from(songsInSetlist.children);
        const song_ids = [], notes = [], order = [];

        listItems.forEach(li => {
            const id = li.dataset.itemId;
            const type = li.dataset.itemType;
            order.push(id);
            if (type === 'song') {
                song_ids.push(id);
            } else if (type === 'note') {
                notes.push({ id: id, type: 'note', title: li.querySelector('em').textContent });
            }
        });

        const extraDataPayload = { order, notes };
        document.getElementById('setlistNotes').value = JSON.stringify(extraDataPayload);

        try {
            await Promise.all([
                api.updateSetlistSongOrder(setlistId, song_ids),
                handleSaveSetlistDetails() 
            ]);
            setStatus('Setlist saved!', false);
        } catch (error) {
            setStatus(`Error saving setlist: ${error.message}`, true);
            await handleSetlistSelection(setlistId);
        }
    }
    
    async function handleSaveSetlistDetails() {
        const setlistId = setlistSelector.value;
        if (!setlistId) return;
        const payload = {
            name: currentSetlistTitle.textContent,
            venue: document.getElementById('setlistVenue').value,
            event_date: document.getElementById('setlistDate').value,
            logo_url: document.getElementById('setlistLogoUrl').value,
            notes: document.getElementById('setlistNotes').value
        };
        try {
            await api.updateSetlistDetails(setlistId, payload);
            setStatus('Setlist details saved!', false);
        } catch (error) {
            setStatus(`Error saving details: ${error.message}`, true);
        }
    }

    async function handleCreateSetlist() { const name = newSetlistInput.value.trim(); if (!name) return alert('Please enter a name for the new setlist.'); try { const newSetlist = await api.createSetlist({ name }); newSetlistInput.value = ''; setStatus('Setlist created!', false); await loadSetlists(newSetlist.id); } catch (error) { setStatus(`Error creating setlist: ${error.message}`, true); } }
    
    async function handleDeleteSetlist() { const setlistId = setlistSelector.value; const setlistName = setlistSelector.options[setlistSelector.selectedIndex].text; if (!setlistId) return; if (confirm(`ARE YOU SURE you want to permanently delete the setlist "${setlistName}"? This cannot be undone.`)) { try { await api.deleteSetlist(setlistId); setStatus(`Setlist "${setlistName}" deleted.`, false); await loadSetlists(); handleSetlistSelection(null); } catch(error) { setStatus(`Failed to delete setlist: ${error.message}`, true); } } }
    
    async function handleAddSongToSetlist() {
        const setlistId = setlistSelector.value;
        if (!songData.id) return alert('Please save the current song before adding it to a setlist.');
        if (!setlistId) return alert('Please select a setlist first.');
        try {
            await api.addSongToSetlist(setlistId, songData.id);
            setStatus(`'${songData.title}' added to setlist.`, false);
            await handleSetlistSelection(setlistId);
        } catch(error) {
            setStatus(`Failed to add song: ${error.message}`, true);
        }
    }
    
    async function handleRemoveItemFromSetlist(itemLi) {
        const setlistId = setlistSelector.value;
        const itemId = itemLi.dataset.itemId;
        const itemType = itemLi.dataset.itemType;
        if (!setlistId || !itemId) return;

        if (confirm("Are you sure you want to remove this item from the setlist?")) {
            try {
                if (itemType === 'song') {
                   await api.removeSongFromSetlist(setlistId, itemId);
                }
                itemLi.remove();
                await saveSetlistOrderAndNotes();
            } catch(error) {
                setStatus(`Failed to remove item: ${error.message}`, true);
                await handleSetlistSelection(setlistId);
            }
        }
    }
    
    async function handlePrintSetlist(drummerMode = false) {
        const setlistId = setlistSelector.value;
        if (!setlistId) return;
        setStatus('Generating PDF...');
        try {
            const setlist = await api.getSetlist(setlistId);
            let extraData = { order: [], notes: [] };
            try { const parsedNotes = JSON.parse(setlist.notes || '{}'); if (parsedNotes.order && Array.isArray(parsedNotes.notes)) extraData = parsedNotes; } catch (e) {}
            const allItemsMap = new Map();
            (setlist.songs || []).forEach(s => allItemsMap.set(s.id.toString(), { ...s, type: 'song' }));
            (extraData.notes || []).forEach(n => allItemsMap.set(n.id.toString(), n));
            const orderedItems = (extraData.order.length > 0 ? extraData.order : (setlist.songs || []).map(s => s.id)) .map(id => allItemsMap.get(id.toString())).filter(Boolean);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const leftMargin = 15, rightMargin = doc.internal.pageSize.getWidth() - 15, yStart = 20; let y = yStart;
            const pageHeight = doc.internal.pageSize.getHeight(), marginBottom = 20, maxWidth = rightMargin - leftMargin;
            const getImageDataUrl = async (url) => { if (!url) return Promise.resolve(null); return new Promise((resolve) => { const img = new Image(); img.crossOrigin = 'Anonymous'; img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }; img.onerror = () => { console.error('Failed to load watermark image.'); resolve(null); }; img.src = url; }); };
            const logoDataUrl = await getImageDataUrl(setlist.logo_url);
            const addWatermarkToPage = () => { if (logoDataUrl) { doc.setGState(new doc.GState({opacity: 0.1})); doc.addImage(logoDataUrl, 'PNG', rightMargin - 20, 10, 20, 20); doc.setGState(new doc.GState({opacity: 1.0})); } };
            const checkPageBreak = (neededHeight) => { if (y + neededHeight > pageHeight - marginBottom) { addWatermarkToPage(); doc.addPage(); y = yStart; addWatermarkToPage(); } };
            addWatermarkToPage();
            doc.setFontSize(26); doc.text(setlist.name, doc.internal.pageSize.getWidth() / 2, y, { align: 'center', maxWidth }); y += 15;
            doc.setFontSize(16); if (setlist.venue) { doc.text(setlist.venue, doc.internal.pageSize.getWidth() / 2, y, { align: 'center', maxWidth }); y += 8; }
            if (setlist.event_date) { doc.text(new Date(setlist.event_date).toLocaleDateString(undefined, { timeZone: 'UTC' }), doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); } y += 15;
            doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.text('Song List:', leftMargin, y); y += 8; doc.setFont(undefined, 'normal');
            orderedItems.forEach((item, index) => {
                checkPageBreak(8); let titleText;
                if (item.type === 'song') { titleText = `${index + 1}. ${item.title} (${item.artist || 'Unknown'})`; const splitTitle = doc.splitTextToSize(titleText, maxWidth - 5); doc.text(splitTitle, leftMargin + 5, y); y += splitTitle.length * 7; }
                else { titleText = `${index + 1}. --- ${item.title} ---`; doc.setFont(undefined, 'italic'); doc.text(titleText, leftMargin + 5, y); y += 7; doc.setFont(undefined, 'normal'); }
            });
            for (const item of orderedItems) {
                addWatermarkToPage(); doc.addPage(); y = yStart; addWatermarkToPage();
                if (item.type === 'song') {
                    doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text(item.title, leftMargin, y, { maxWidth }); y += 8;
                    doc.setFontSize(14); doc.setFont(undefined, 'italic'); doc.text(item.artist || 'Unknown Artist', leftMargin, y, { maxWidth }); y += 12;
                    const songBlocks = (typeof item.song_blocks === 'string') ? JSON.parse(item.song_blocks || '[]') : (item.song_blocks || []);
                    for (const block of songBlocks) {
                        let blockToRender = block.type === 'reference' ? (songBlocks.find(b => b.id === block.originalId) || block) : block;
                        if (!blockToRender || (!blockToRender.content && (!blockToRender.data || !blockToRender.data.notes))) continue;
                        if(drummerMode && !(blockToRender.type === 'lyrics' || blockToRender.type === 'drum_tab')) continue;
                        if(!drummerMode && blockToRender.type === 'drum_tab') continue;
                        checkPageBreak(12); doc.setFont(undefined, 'bold'); doc.setFontSize(12); doc.text(block.label, leftMargin, y, { maxWidth }); y += 7;
                        doc.setFont('Courier', 'normal'); doc.setFontSize(10); const lineHeight = 5;
                        const contentToRender = blockToRender.type === 'tab' ? renderTransposedTab(blockToRender) : (blockToRender.content || '');
                        for (const line of contentToRender.split('\n')) {
                            if (blockToRender.type === 'lyrics') {
                                const parsed = parseLineForRender(line);
                                if (!drummerMode) { checkPageBreak(lineHeight * 2.5); doc.setTextColor(60, 60, 60); doc.text(parsed.chordLine, leftMargin, y, { maxWidth }); y += lineHeight; } else { checkPageBreak(lineHeight * 1.5); }
                                doc.setTextColor(0, 0, 0); const splitLyrics = doc.splitTextToSize(parsed.lyricLine, maxWidth); doc.text(splitLyrics, leftMargin, y); y += (splitLyrics.length * lineHeight) + (lineHeight * 0.5);
                            } else if (blockToRender.type === 'tab' || blockToRender.type === 'drum_tab') { const splitText = doc.splitTextToSize(line, maxWidth); checkPageBreak(splitText.length * lineHeight); doc.setTextColor(0,0,0); doc.text(splitText, leftMargin, y); y += (splitText.length * lineHeight) + (lineHeight * 0.5); }
                        }
                        y += lineHeight;
                    }
                } else { doc.setFontSize(22); doc.setFont(undefined, 'bold'); doc.text(item.title, doc.internal.pageSize.getWidth() / 2, pageHeight / 2, { align: 'center', maxWidth }); }
            }
            addWatermarkToPage();
            doc.save(`${setlist.name.replace(/\s/g, '_')}${drummerMode ? '_Drummer' : ''}.pdf`);
            setStatus('PDF generated.', false);
        } catch (error) { setStatus(`Failed to generate PDF: ${error.message}`, true); console.error("PDF generation error:", error); }
    }
    function renderSongBlocks() { songBlocksContainer.innerHTML = ''; (songData.song_blocks || []).forEach(block => songBlocksContainer.appendChild(createBlockElement(block))); renderAddBlockButtons(); renderPreview(); initializeSortable(); }
    function createBlockElement(block) { const div = document.createElement('div'); div.className = 'song-block'; div.dataset.blockId = block.id; let contentHtml = '', headerControls = ''; const drumPlaceholder = `HH|x-x-x-x-x-x-x-x-|\nSD|----o-------o---|\nBD|o-------o-------|`; if (block.type === 'lyrics') { contentHtml = `<textarea class="form-textarea lyrics-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="Enter lyrics and [chords]...">${block.content || ''}</textarea><div class="resize-handle"></div>`; } else if (block.type === 'tab') { const stringOptions = [6, 7, 8].map(num => `<option value="${num}" ${block.strings === num ? 'selected' : ''}>${num}-String</option>`).join(''); contentHtml = `<div class="mb-2"><label class="text-xs text-gray-400">Instrument:</label><select class="form-select form-input text-sm w-32 bg-gray-900" data-action="change-strings">${stringOptions}</select></div><div class="fretboard-wrapper"><div id="fretboard-${block.id}"></div></div>`; const isEditMode = block.editMode || false; const editButtonClass = isEditMode ? 'btn-edit-mode' : 'btn-secondary'; headerControls = `<button class="btn ${editButtonClass} btn-sm" data-action="edit-tab">${isEditMode ? 'Done Editing' : 'Edit'}</button>`; } else if (block.type === 'drum_tab') { contentHtml = `<textarea class="form-textarea drum-tab-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="${drumPlaceholder}">${block.content || ''}</textarea><div class="resize-handle"></div>`; } else if (block.type === 'reference') { const originalBlock = songData.song_blocks.find(b => b.id === block.originalId); contentHtml = `<div class="p-4 bg-gray-800 rounded-md text-gray-400 italic">Reference to: ${originalBlock ? originalBlock.label : 'Unknown Section'}</div>`; } div.innerHTML = `<div class="block-header"><div class="flex items-center gap-4"><div class="flex items-center gap-2"><span class="font-bold">${block.label}</span><span class="text-xs text-gray-400">(${block.type.replace('_', ' ')})</span></div></div><div class="flex items-center gap-2">${headerControls}<button class="btn-sm text-xs hover:underline" data-action="rename">Rename</button><button class="btn-sm text-red-400 hover:underline" data-action="delete">Delete</button></div></div><div class="block-content">${contentHtml}</div>`; if (block.type === 'tab') setTimeout(() => drawFretboard(block.id), 0); return div; }
    function renderAddBlockButtons() { const createdSections = songData.song_blocks.filter(b => b.type !== 'reference'); let referenceButtonsHtml = ''; if (createdSections.length > 0) { referenceButtonsHtml = `<div class="relative inline-block text-left"><button id="insert-ref-btn" class="btn btn-secondary">Insert Existing Section</button><div id="ref-dropdown" class="hidden origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10"><div class="py-1" role="menu" aria-orientation="vertical">${createdSections.map(b => `<a href="#" class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600" data-original-id="${b.id}" role="menuitem">${b.label}</a>`).join('')}</div></div></div>`; } addBlockButtonsContainer.innerHTML = `<button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Verse </button><button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Chorus </button><button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Bridge </button><button class="btn btn-secondary" data-action="add" data-type="tab"> + Tab Section </button><button class="btn btn-secondary" data-action="add" data-type="drum_tab"> + Drum Tab </button>${referenceButtonsHtml}`; }
    function renderPreview() { let previewHtml = ''; (songData.song_blocks || []).forEach(block => { let blockToRender = block.type === 'reference' ? (songData.song_blocks.find(b => b.id === block.originalId) || block) : block; previewHtml += `<h4 class="text-lg font-bold mt-4 text-gray-400">${block.label}</h4>`; if (!blockToRender) return; if (blockToRender.type === 'lyrics') { (blockToRender.content || '').split('\n').forEach(line => { const parsed = parseLineForRender(line); previewHtml += `<div class="live-preview-chords">${parsed.chordLine}</div><div>${parsed.lyricLine}</div>`; }); } else if (blockToRender.type === 'tab') { previewHtml += `<div class="tab-preview">${renderTransposedTab(blockToRender)}</div>`; } else if (blockToRender.type === 'drum_tab') { previewHtml += `<div class="tab-preview">${blockToRender.content || ''}</div>`; } }); livePreview.innerHTML = previewHtml; }
    function getFretFromClick(evt, svgEl) { const wrapper = svgEl.closest('.fretboard-wrapper'); if (!wrapper) return null; const svgRect = svgEl.getBoundingClientRect(); const x = evt.clientX - svgRect.left + wrapper.scrollLeft; const y = evt.clientY - svgRect.top; const blockId = svgEl.id.split('-').pop(); const block = songData.song_blocks.find(b => b.id === blockId); if (!block) return null; const numStrings = block.strings || 6; const stringConfig = STRING_CONFIG[numStrings]; const stringIndex = Math.floor(y / stringConfig.stringSpacing); const rawFret = (x - FRETBOARD_CONFIG.nutWidth) / FRETBOARD_CONFIG.fretSpacing; const fret = Math.max(0, Math.round(rawFret)); if (stringIndex >= 0 && stringIndex < numStrings && fret <= FRETBOARD_CONFIG.frets) { return { string: stringIndex, fret, position: x }; } return null; }
    function drawFretboard(blockId) { const container = document.getElementById(`fretboard-${blockId}`); if (!container) return; const block = songData.song_blocks.find(b => b.id === blockId); if (!block) return; const numStrings = block.strings || 6; const stringConfig = STRING_CONFIG[numStrings]; const { frets, width, nutWidth, fretSpacing, dotFrets, dotRadius } = FRETBOARD_CONFIG; const { height, stringSpacing } = stringConfig; let svgHTML = `<svg id="fretboard-svg-${blockId}" width="${width}" height="${height}" style="min-width: 100%;"><rect class="fretboard-bg" width="${width}" height="${height}" fill="#2d3748" />`; for (let i = 0; i < numStrings; i++) { svgHTML += `<line class="fretboard-string" x1="0" y1="${stringSpacing / 2 + i * stringSpacing}" x2="${width}" y2="${stringSpacing / 2 + i * stringSpacing}" />`; } svgHTML += `<rect class="fretboard-nut" x="0" y="0" width="${nutWidth}" height="${height}" fill="#1e1e1e" />`; for (let i = 1; i <= frets; i++) { svgHTML += `<line class="fretboard-fret" x1="${nutWidth + i * fretSpacing}" y1="0" x2="${nutWidth + i * fretSpacing}" y2="${height}" stroke="#4a5563" stroke-width="1" />`; } dotFrets.forEach(fret => { const x = nutWidth + (fret - 0.5) * fretSpacing; if (fret % 12 === 0) { svgHTML += `<circle class="fretboard-dot" cx="${x}" cy="${stringSpacing * (numStrings / 4)}" r="${dotRadius}" fill="#555" /><circle class="fretboard-dot" cx="${x}" cy="${height - (stringSpacing * (numStrings / 4))}" r="${dotRadius}" fill="#555" />`; } else { svgHTML += `<circle class="fretboard-dot" cx="${x}" cy="${height / 2}" r="${dotRadius}" fill="#555"/>`; } }); svgHTML += `<g id="fretboard-notes-group-${blockId}"></g></svg>`; container.innerHTML = svgHTML; drawNotesOnFretboard(blockId); const svgEl = document.getElementById(`fretboard-svg-${blockId}`); if (svgEl) attachFretboardListeners(svgEl); }
    function drawNotesOnFretboard(blockId) { const block = songData.song_blocks.find(b => b.id === blockId); const notesGroup = document.getElementById(`fretboard-notes-group-${blockId}`); if (!notesGroup || !block || block.type !== 'tab') return; notesGroup.innerHTML = ''; const numStrings = block.strings || 6; const stringConfig = STRING_CONFIG[numStrings]; const totalOffset = (TUNINGS[songData.tuning]?.offset ?? 0) + songData.capo; (block.data?.notes || []).forEach((note, index) => { if (note.string >= numStrings) return; const transposedFret = note.fret - totalOffset; if (transposedFret < 0) return; const y = stringConfig.stringSpacing / 2 + note.string * stringConfig.stringSpacing; const x = note.position; const isSelected = selectedNote.blockId === blockId && selectedNote.noteIndex === index; notesGroup.innerHTML += `<g class="note-group"><circle class="fretboard-note ${isSelected ? 'selected' : ''}" cx="${x}" cy="${y}" r="${FRETBOARD_CONFIG.noteRadius}" data-note-index="${index}"/><text class="fretboard-note-text" x="${x}" y="${y}">${transposedFret}</text></g>`; }); }
    function renderTransposedTab(tabBlock) { if (!tabBlock.data || !tabBlock.data.notes || tabBlock.data.notes.length === 0) return 'No tab data.'; const numStrings = tabBlock.strings || 6; const tuningInfo = TUNINGS[songData.tuning]; const stringNames = tuningInfo?.strings?.slice(0, numStrings) || STRING_CONFIG[6].names; const totalOffset = (tuningInfo?.offset ?? 0) + songData.capo + songData.transpose; const positionMap = new Map(); const sortedNotes = [...tabBlock.data.notes].sort((a,b) => a.position - b.position); sortedNotes.forEach(note => { if (note.string >= numStrings) return; const transposedFret = note.fret - totalOffset; if (transposedFret < 0) return; const charPosition = Math.floor((note.position - FRETBOARD_CONFIG.nutWidth) / 10); if (charPosition < 0) return; if (!positionMap.has(charPosition)) positionMap.set(charPosition, Array(numStrings).fill(null)); positionMap.get(charPosition)[note.string] = transposedFret; }); if (positionMap.size === 0) return 'Notes out of range for current settings.'; const sortedPositions = [...positionMap.keys()].sort((a,b) => a - b); const lines = stringNames.map(name => `${name.padEnd(2, ' ')}|`); let lastCharPos = 0; sortedPositions.forEach(charPos => { const notesAtPos = positionMap.get(charPos); const padding = charPos - lastCharPos; if (padding > 1) lines.forEach((_, i) => lines[i] += '-'.repeat(padding - 1)); let maxFretWidth = 1; notesAtPos.forEach(fret => { if (fret !== null) maxFretWidth = Math.max(maxFretWidth, String(fret).length) }); lines.forEach((_, i) => { lines[i] += (notesAtPos[i] !== null) ? String(notesAtPos[i]).padEnd(maxFretWidth, '-') : '-'.repeat(maxFretWidth) }); lastCharPos = charPos + maxFretWidth -1; }); return lines.join('\n'); }
    function updateBlockData(blockId, field, value, height) { const block = songData.song_blocks.find(b => b.id === blockId); if (block) { if (field) block[field] = value; if (height) block.height = height; if(field === 'content') renderPreview(); } }
    async function loadSong(id) { if (!id || id === 'new') { initializeNewSong(true); return; } setStatus('Loading song...'); try { const data = await api.getSheet(id); songData = { id: data.id, title: data.title || '', artist: data.artist || '', audio_url: data.audio_url, song_blocks: Array.isArray(data.song_blocks) ? data.song_blocks : [], tuning: data.tuning ?? 'E_STANDARD', capo: data.capo ?? 0, transpose: data.transpose ?? 0 }; titleInput.value = songData.title; artistInput.value = songData.artist; const audioPlayerContainer = document.getElementById('audioPlayerContainer'); const audioPlayer = document.getElementById('audioPlayer'); if (songData.audio_url) { audioPlayerContainer.classList.remove('hidden'); audioPlayer.src = songData.audio_url; } else { audioPlayerContainer.classList.add('hidden'); audioPlayer.src = ''; } updateMusicalSettingsUI(); renderSongBlocks(); setStatus('Song loaded.'); updateSoundingKey(); } catch (error) { setStatus(`Error loading song: ${error.message}`, true); initializeNewSong(true); } }
    async function initializeNewSong(forceNew = false) { const createBlankSong = () => { songData = { id: null, title: '', artist: '', audio_url: null, song_blocks: [{ id: `block_${Date.now()}`, type: 'lyrics', label: 'Verse 1', content: '', height: 100 }], tuning: 'E_STANDARD', capo: 0, transpose: 0 }; titleInput.value = ''; artistInput.value = ''; if (songSelector) songSelector.value = 'new'; const audioPlayerContainer = document.getElementById('audioPlayerContainer'); if (audioPlayerContainer) audioPlayerContainer.classList.add('hidden'); const audioPlayer = document.getElementById('audioPlayer'); if (audioPlayer) audioPlayer.src = ''; updateMusicalSettingsUI(); renderSongBlocks(); updateSoundingKey(); }; if (forceNew) { createBlankSong(); return; } try { const songs = await api.getSheets(); if (songs && songs.length > 0) { await loadSong(songs[0].id); if (songSelector) songSelector.value = songs[0].id; } else { createBlankSong(); } } catch(e) { createBlankSong(); setStatus('Could not load songs. Starting new.', true); } }
    async function handleSave() { if (isDemoMode) { setStatus('Saving is disabled in the demo.', true); return; } saveBtn.disabled = true; setStatus('Saving...'); try { songData.title = titleInput.value || 'Untitled'; songData.artist = artistInput.value || 'Unknown Artist'; const savedSong = songData.id ? await api.updateSheet(songData.id, songData) : await api.createSheet(songData); songData.id = savedSong.id; setStatus('Saved successfully!'); if (!songSelector.querySelector(`option[value="${savedSong.id}"]`)) { await loadSheetList(savedSong.id); } else { songSelector.querySelector(`option[value="${savedSong.id}"]`).textContent = songData.title; songSelector.value = savedSong.id; } } catch (error) { setStatus(`Save failed: ${error.message}`, true); } finally { saveBtn.disabled = false; } }
    function initializeSortable() { if (songBlocksContainer.sortableInstance) songBlocksContainer.sortableInstance.destroy(); songBlocksContainer.sortableInstance = new Sortable(songBlocksContainer, { animation: 150, handle: '.block-header', onEnd: (evt) => { const [movedItem] = songData.song_blocks.splice(evt.oldIndex, 1); songData.song_blocks.splice(evt.newIndex, 0, movedItem); renderPreview(); } }); }
    function setStatus(message, isError = false) { statusMessage.textContent = message; statusMessage.style.color = isError ? '#ef4444' : '#9ca3af'; if (message) setTimeout(() => statusMessage.textContent = '', 3000); }
    
    function parseLineForRender(rawLine) {
        if (!rawLine || !rawLine.trim()) return { chordLine: ' ', lyricLine: ' ' };
        let chordLine = ""; let lyricLine = "";
        const parts = rawLine.split(/(\[[^\]]+\])/g);
        for (const part of parts) {
            if (part.startsWith('[') && part.endsWith(']')) {
                const chordName = part.slice(1, -1);
                chordLine += chordName;
                lyricLine += ' '.repeat(chordName.length);
            } else {
                lyricLine += part;
                chordLine += ' '.repeat(part.length);
            }
        }
        return { chordLine: chordLine.trimEnd() || ' ', lyricLine: lyricLine.trimEnd() || ' ' };
    }

    function populateTuningSelector() { for (const key in TUNINGS) { const option = document.createElement('option'); option.value = key; option.textContent = TUNINGS[key].name; tuningSelector.appendChild(option); } }
    async function loadSheetList(selectId = null) { try { const songs = await api.getSheets(); songs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)); songSelector.innerHTML = '<option value="new">-- Create New Song --</option>'; songs.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title || 'Untitled'; songSelector.appendChild(o); }); if (selectId) songSelector.value = selectId; } catch (e) { setStatus('Failed to load songs.', true); } }
    async function handleDelete() { if (isDemoMode) { setStatus('Deleting is disabled in the demo.', true); return; } if (!songData.id) { setStatus("Cannot delete an unsaved song.", true); return; } if (confirm(`Are you sure you want to delete "${songData.title}"?`)) { try { setStatus('Deleting...'); await api.deleteSheet(songData.id); setStatus('Song deleted.'); await loadSheetList(); await initializeNewSong(); } catch (e) { setStatus(`Failed to delete: ${e.message}`, true); } } }
    function transposeChord(chord, amount) { const regex = /^([A-G][b#]?)(.*)/; const match = chord.match(regex); if (!match) return chord; let note = match[1]; let index = sharpScale.indexOf(note); if (index === -1) { const flatNotes = { 'Bb':'A#', 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#'}; note = flatNotes[note] || note; index = sharpScale.indexOf(note); } if (index === -1) return chord; const newIndex = (index + amount + 12) % 12; return sharpScale[newIndex] + match[2]; }
    function handleTranspose(amount) { const newTranspose = songData.transpose + amount; songData.transpose = newTranspose; updateMusicalSettingsUI(); songData.song_blocks.forEach(block => { if (block.type === 'lyrics' && block.content) { block.content = block.content.replace(/\[([^\]]+)\]/g, (match, chord) => `[${transposeChord(chord, amount)}]`); } }); renderSongBlocks(); }
    function renderChordQueue() { chordQueueDiv.innerHTML = ''; if (chordQueue.length === 0) { document.querySelectorAll('.lyrics-block').forEach(el => el.classList.remove('placement-mode')); clearQueueBtn.disabled = true; return; } document.querySelectorAll('.lyrics-block').forEach(el => el.classList.add('placement-mode')); clearQueueBtn.disabled = false; chordQueue.forEach((name, index) => { const pill = document.createElement('span'); pill.className = `queue-pill ${index === chordQueueIndex ? 'next' : ''}`; pill.textContent = name; chordQueueDiv.appendChild(pill); }); }
    async function loadChords() { try { const chords = (isDemoMode) ? ['A', 'Am', 'B', 'C', 'Cmaj7', 'D', 'Dm', 'E', 'Em', 'E7', 'F', 'G'].map(name => ({name})) : await api.getChords(); chordPalette.innerHTML = ''; chords.forEach(c => { const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-sm'; btn.onclick = (e) => { if (e.ctrlKey || e.metaKey) { chordQueue.push(c.name); renderChordQueue(); } else if (lastFocusedLyricsBlock) { const t = `[${c.name}]`; const p = lastFocusedLyricsBlock.selectionStart; lastFocusedLyricsBlock.value = lastFocusedLyricsBlock.value.slice(0, p) + t + lastFocusedLyricsBlock.value.slice(p); lastFocusedLyricsBlock.focus(); lastFocusedLyricsBlock.setSelectionRange(p + t.length, p + t.length); updateBlockData(lastFocusedLyricsBlock.closest('.song-block').dataset.blockId, 'content', lastFocusedLyricsBlock.value); }}; btn.textContent = c.name; chordPalette.appendChild(btn); }); } catch (e) { setStatus('Failed to load chords.', true); } }
    async function handleAddChord() { if (isDemoMode) { setStatus('Cannot add chords in demo.', true); return; } const name = newChordInput.value.trim(); if (!name) return; try { await api.createChord({ name }); newChordInput.value = ''; setStatus(`'${name}' added.`); await loadChords(); } catch (e) { setStatus(e.message, true); } }
    async function startRecording() { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorder = new MediaRecorder(stream); mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); }; mediaRecorder.onstop = handleSaveRecording; audioChunks = []; mediaRecorder.start(); recordBtn.textContent = 'Recording...'; recordBtn.classList.add('recording'); recordBtn.disabled = true; stopBtn.disabled = false; recordingStatus.textContent = 'Recording in progress.'; } catch (err) { setStatus('Microphone access denied.', true); console.error("Error accessing microphone:", err); } }
    function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); recordBtn.textContent = 'Record'; recordBtn.classList.remove('recording'); recordBtn.disabled = false; stopBtn.disabled = true; recordingStatus.textContent = 'Processing...'; }
    async function handleSaveRecording() { const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); const formData = new FormData(); formData.append('file', audioBlob); formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET); const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`; try { const response = await fetch(url, { method: 'POST', body: formData }); if (!response.ok) throw new Error('Upload to Cloudinary failed.'); const data = await response.json(); songData.audio_url = data.secure_url; await handleSave(); recordingStatus.textContent = 'Recording saved.'; document.getElementById('audioPlayerContainer').classList.remove('hidden'); document.getElementById('audioPlayer').src = data.secure_url; } catch (error) { setStatus('Failed to upload recording.', true); console.error("Upload error:", error); recordingStatus.textContent = ''; } }
    
    function initializeDemoSong() {
        songData = { 
            id: 'demo-song', title: 'The ProAnthem Feature Tour', artist: 'The Dev Team', audio_url: null, 
            song_blocks: [
                { id: 'block_1', type: 'lyrics', label: 'Lyrics & Chords', content: '[G]Just type your lyrics [D]in this space,\nPut [Em]chords in brackets, [C]right in place.\nThe [G]preview updates, [D]as you go,\nA [C]perfect layout for your [G]show.', height: 140 },
                { id: 'block_2', type: 'lyrics', label: 'Interactive Tabs', content: '[G]Below this block, a [D]fretboard lies,\nClick [Em]any string, a [C]note will rise.\nThen [G]drag and drop to [D]find your sound,\nThe [C]cleanest tabs you\'ve ever [G]found.', height: 140 },
                { id: 'block_3', type: 'tab', label: 'Guitar Riff Example', strings: 6, data: { notes: [{string: 3, fret: 5, position: 200}, {string: 3, fret: 7, position: 350}, {string: 2, fret: 5, position: 500}, {string: 2, fret: 7, position: 650}]}, editMode: false },
                { id: 'block_4', type: 'lyrics', label: 'Musical Settings', content: '[Am]Is the key too high? [G]Feeling strained?\nUse the [C]Transpose buttons, [F]no song\'s chained.\nAdd a [Am]capo, change the [G]tuning too,\nThe [F]sidebar settings [E7]work for you.', height: 140 },
                { id: 'block_5', type: 'lyrics', label: 'The Song Builder', content: '[C]Need another verse? A [G]bridge or two?\nThe [Am]"Add Section" buttons [F]wait for you.\nThen [C]grab the header, [G]drag and drop,\nArrange your song, right [C]from the top.', height: 140 },
                { id: 'block_6', type: 'lyrics', label: 'Save & Sign Up (Outro)', content: '[G]This is a demo, [D]please be aware,\nYour [Em]masterpiece won\'t [C]save from here.\nFor [G]setlists, voice memos, and [D]cloud-based drive,\nJust [C]sign on up and watch your music [G]thrive!', height: 140 }
            ],
            tuning: 'E_STANDARD', capo: 0, transpose: 0
        };
        titleInput.value = songData.title;
        artistInput.value = songData.artist;
        updateMusicalSettingsUI();
        renderSongBlocks();
        updateSoundingKey();
        setStatus('Demo loaded. Your changes will not be saved.');
    }

    // --- EVENT LISTENERS ---
    [tuningSelector, capoFretInput].forEach(el => el.addEventListener('input', () => { songData.tuning = tuningSelector.value; songData.capo = parseInt(capoFretInput.value, 10) || 0; renderSongBlocks(); updateSoundingKey(); }));
    transposeUpBtn?.addEventListener('click', () => handleTranspose(1)); 
    transposeDownBtn?.addEventListener('click', () => handleTranspose(-1)); 
    saveBtn?.addEventListener('click', handleSave); 
    deleteBtn?.addEventListener('click', handleDelete); 
    addChordBtn?.addEventListener('click', handleAddChord); 
    newChordInput?.addEventListener('keyup', (e) => e.key === 'Enter' && handleAddChord()); 
    clearQueueBtn?.addEventListener('click', () => { chordQueue = []; chordQueueIndex = 0; renderChordQueue(); });
    songBlocksContainer?.addEventListener('focusin', e => { if (e.target.classList.contains('lyrics-block')) lastFocusedLyricsBlock = e.target; });
    songBlocksContainer?.addEventListener('input', e => { if (e.target.dataset.field) { const blockId = e.target.closest('.song-block').dataset.blockId; updateBlockData(blockId, 'content', e.target.value); updateSoundingKey(); } });
    songBlocksContainer?.addEventListener('mousedown', e => { if (e.target.classList.contains('resize-handle')) { e.preventDefault(); const blockEl = e.target.closest('.song-block'); const textarea = blockEl.querySelector('.form-textarea'); if (textarea) { activeResize = { element: textarea, startY: e.clientY, startHeight: textarea.offsetHeight, blockId: blockEl.dataset.blockId }; document.body.style.cursor = 'ns-resize'; } } });
    function attachFretboardListeners(svgEl) { const blockId = svgEl.id.split('-').pop(); const block = songData.song_blocks.find(b => b.id === blockId); if (!block) return; svgEl.addEventListener('mousedown', (e) => { isDraggingNote = false; if (block.editMode && e.target.closest('.note-group')) { isDraggingNote = true; const noteGroup = e.target.closest('.note-group'); const noteIndex = parseInt(noteGroup.querySelector('.fretboard-note').dataset.noteIndex, 10); selectedNote = { blockId, noteIndex }; drawNotesOnFretboard(blockId); } }); svgEl.addEventListener('click', (e) => { if (isDraggingNote) { isDraggingNote = false; return; } const isNoteClick = e.target.closest('.note-group'); if (block.editMode) { if (isNoteClick) { const clickedNoteIndex = parseInt(isNoteClick.querySelector('.fretboard-note').dataset.noteIndex, 10); if (selectedNote.blockId === blockId && selectedNote.noteIndex === clickedNoteIndex) { block.data.notes.splice(clickedNoteIndex, 1); selectedNote = { blockId: null, noteIndex: null }; } else { selectedNote = { blockId, noteIndex: clickedNoteIndex }; } } else { selectedNote = { blockId: null, noteIndex: null }; } drawNotesOnFretboard(blockId); } else { if (!isNoteClick) { const clickData = getFretFromClick(e, svgEl); if (clickData) { fretSelectionContext = { blockId, string: clickData.string, position: clickData.position }; fretNumberSelector.innerHTML = ''; for (let i = 0; i <= FRETBOARD_CONFIG.frets; i++) { const option = new Option(i, i); if (i === clickData.fret) option.selected = true; fretNumberSelector.appendChild(option); } fretSelectionModal.style.left = `${e.clientX + 5}px`; fretSelectionModal.style.top = `${e.clientY + 5}px`; fretSelectionModal.classList.remove('hidden'); } } } }); }
    document.addEventListener('mousemove', e => { if (activeResize.element) { const height = activeResize.startHeight + e.clientY - activeResize.startY; activeResize.element.style.height = `${Math.max(50, height)}px`; } if (isDraggingNote && selectedNote.blockId) { const block = songData.song_blocks.find(b => b.id === selectedNote.blockId); const note = block?.data?.notes[selectedNote.noteIndex]; if (note) { const svg = document.getElementById(`fretboard-svg-${selectedNote.blockId}`); const clickData = getFretFromClick(e, svg); if (clickData) { note.position = clickData.position; note.string = clickData.string; drawNotesOnFretboard(selectedNote.blockId); } } } });
    document.addEventListener('mouseup', () => { if (activeResize.element) { const newHeight = activeResize.element.offsetHeight; updateBlockData(activeResize.blockId, null, null, newHeight); activeResize = { element: null, startY: 0, startHeight: 0 }; document.body.style.cursor = ''; } if(isDraggingNote) { isDraggingNote = false; renderPreview(); } });
    songBlocksContainer?.addEventListener('change', (e) => { if (e.target.dataset.action === 'change-strings') { const blockEl = e.target.closest('.song-block'); const blockId = blockEl.dataset.blockId; const block = songData.song_blocks.find(b => b.id === blockId); if (block) { block.strings = parseInt(e.target.value, 10); drawFretboard(blockId); } } });
    songBlocksContainer?.addEventListener('click', (e) => { const blockEl = e.target.closest('.song-block'); if (!blockEl) return; const blockId = blockEl.dataset.blockId; const block = songData.song_blocks.find(b => b.id === blockId); if (e.target.classList.contains('lyrics-block') && chordQueue.length > 0) { e.preventDefault(); const textarea = e.target; const chordToPlace = chordQueue[chordQueueIndex]; const t = `[${chordToPlace}]`; const p = textarea.selectionStart; textarea.value = textarea.value.slice(0, p) + t + textarea.value.slice(p); textarea.focus(); const newPos = p + t.length; textarea.setSelectionRange(newPos, newPos); chordQueueIndex = (chordQueueIndex + 1) % chordQueue.length; updateBlockData(blockId, 'content', textarea.value); renderChordQueue(); } else if (e.target.dataset.action === 'delete') { if (confirm('Are you sure?')) { songData.song_blocks = songData.song_blocks.filter(b => b.id !== blockId && b.originalId !== blockId); renderSongBlocks(); } } else if (e.target.dataset.action === 'rename') { const newLabel = prompt('Enter new label:', block.label); if (newLabel) { block.label = newLabel; renderSongBlocks(); } } else if (e.target.dataset.action === 'edit-tab') { const button = e.target; block.editMode = !block.editMode; button.textContent = block.editMode ? 'Done Editing' : 'Edit'; button.classList.toggle('btn-secondary'); button.classList.toggle('btn-edit-mode'); if (!block.editMode && selectedNote.blockId === blockId) { selectedNote = {blockId: null, noteIndex: null}; drawNotesOnFretboard(blockId); } } });
    document.addEventListener('keydown', (e) => { if (!selectedNote.blockId || selectedNote.noteIndex === null) return; if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); const block = songData.song_blocks.find(b => b.id === selectedNote.blockId); if (block && block.data && block.data.notes && block.data.notes[selectedNote.noteIndex]) { block.data.notes.splice(selectedNote.noteIndex, 1); const oldBlockId = selectedNote.blockId; selectedNote = { blockId: null, noteIndex: null }; drawNotesOnFretboard(oldBlockId); renderPreview(); } } });
    function confirmFretSelection() { const { blockId, string, position } = fretSelectionContext; const fret = parseInt(fretNumberSelector.value, 10); const block = songData.song_blocks.find(b => b.id === blockId); if(block && string !== null && position !== null && fret >= 0) { const totalOffset = (TUNINGS[songData.tuning]?.offset ?? 0) + songData.capo; if (!block.data) block.data = { notes: [] }; block.data.notes.push({ string, fret: fret + totalOffset, position }); drawNotesOnFretboard(blockId); renderPreview(); } fretSelectionModal.classList.add('hidden'); }
    addBlockButtonsContainer?.addEventListener('click', e => { const target = e.target; if (target.id === 'insert-ref-btn') { document.getElementById('ref-dropdown').classList.toggle('hidden'); } else if (target.closest('#ref-dropdown')) { const originalId = target.dataset.originalId; const originalBlock = songData.song_blocks.find(b => b.id === originalId); if(originalBlock) { songData.song_blocks.push({ id: `block_${Date.now()}`, type: 'reference', label: `Reference to ${originalBlock.label}`, originalId: originalId }); renderSongBlocks(); } document.getElementById('ref-dropdown').classList.add('hidden'); } else if (target.dataset.action === 'add') { const type = target.dataset.type; const baseLabel = target.textContent.trim().replace('+', '').trim(); const count = songData.song_blocks.filter(b => b.label.startsWith(baseLabel)).length + 1; const label = `${baseLabel} ${count}`; const newBlock = { id: `block_${Date.now()}`, type, label, height: 100 }; if (type === 'lyrics' || type === 'drum_tab') newBlock.content = ''; if (type === 'tab') { newBlock.data = { notes: [] }; newBlock.strings = 6; newBlock.editMode = false; } songData.song_blocks.push(newBlock); renderSongBlocks(); } });
    recordBtn?.addEventListener('click', startRecording); 
    stopBtn?.addEventListener('click', stopRecording); 
    songSelector?.addEventListener('change', () => loadSong(songSelector.value)); 
    setlistBtn?.addEventListener('click', openSetlistManager); 
    closeSetlistModalBtn?.addEventListener('click', () => setlistModal.classList.add('hidden')); 
    setlistSelector?.addEventListener('change', (e) => handleSetlistSelection(e.target.value)); 
    saveSetlistDetailsBtn?.addEventListener('click', handleSaveSetlistDetails); 
    createSetlistBtn?.addEventListener('click', handleCreateSetlist); 
    addSongToSetlistBtn?.addEventListener('click', handleAddSongToSetlist); 
    printSetlistBtn?.addEventListener('click', () => handlePrintSetlist(false)); 
    printDrummerSetlistBtn?.addEventListener('click', () => handlePrintSetlist(true)); 
    deleteSetlistBtn?.addEventListener('click', handleDeleteSetlist); 
    addFretBtn?.addEventListener('click', confirmFretSelection); 
    cancelFretBtn?.addEventListener('click', () => fretSelectionModal.classList.add('hidden'));
    songsInSetlist?.addEventListener('click', (e) => { if (e.target.dataset.action === 'remove-item') { handleRemoveItemFromSetlist(e.target.closest('li')); } });
    addSetlistNoteBtn?.addEventListener('click', () => {
        const noteText = newSetlistNoteInput.value.trim();
        if (!noteText) return;
        const noteId = `note_${Date.now()}`;
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-2 bg-gray-750 border border-dashed border-gray-600 rounded cursor-grab';
        li.dataset.itemId = noteId;
        li.dataset.itemType = 'note';
        const gripHandle = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical inline-block mr-2 text-gray-400" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`;
        li.innerHTML = `<span>${gripHandle}<em class="text-indigo-300">${noteText}</em></span><button data-action="remove-item" class="btn btn-danger btn-sm">Remove</button>`;
        songsInSetlist.appendChild(li);
        newSetlistNoteInput.value = '';
        saveSetlistOrderAndNotes();
    });
    deleteAudioBtn?.addEventListener('click', async () => { if (confirm('Are you sure you want to permanently delete this voice memo?')) { songData.audio_url = null; try { await handleSave(); document.getElementById('audioPlayerContainer').classList.add('hidden'); document.getElementById('audioPlayer').src = ''; setStatus('Recording deleted.', false); } catch (error) { setStatus(`Failed to delete recording: ${error.message}`, true); } } });            
    importBtn?.addEventListener('click', () => { importTextarea.value = ''; importModal.classList.remove('hidden'); });
    importCancelBtn?.addEventListener('click', () => { importModal.classList.add('hidden'); });
    importConfirmBtn?.addEventListener('click', () => { const pastedText = importTextarea.value; if (!pastedText.trim()) { alert('Please paste some song text to import.'); return; } const result = parsePastedSong(pastedText); if (result.blocks.length > 0) { songData = { id: null, title: 'Imported Song', artist: '', audio_url: null, song_blocks: result.blocks, tuning: result.metadata.tuning, capo: result.metadata.capo, transpose: 0 }; titleInput.value = songData.title; artistInput.value = songData.artist; if (songSelector) songSelector.value = 'new'; updateMusicalSettingsUI(); renderSongBlocks(); updateSoundingKey(); setStatus('Song imported successfully! Remember to save.'); } else { setStatus('Could not find any content to import.', true); } importModal.classList.add('hidden'); });
    
    // Main execution
    (function main(){ 
        populateTuningSelector(); 
        loadChords();
        if (isDemoMode) {
            initializeDemoSong();
            if (recordBtn) recordBtn.disabled = true;
        } else {
            loadSheetList().then(() => initializeNewSong(false)); 
        }
    })();
}

// --- END OF FILE public/js/app.js ---
