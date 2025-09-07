document.addEventListener('DOMContentLoaded', () => {
    const user = getUserPayload();
    if (user && user.force_reset) {
        document.getElementById('password-reset-modal').classList.remove('hidden');
        document.getElementById('password-reset-form').addEventListener('submit', handleChangePassword);
    } else {
        const hasAccess = checkAccess();
        if (hasAccess && document.getElementById('tool-content')) {
            document.getElementById('tool-content').style.display = 'block';
            initializeApp();
        }
    }
});

async function handleChangePassword(event) {
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
    if (newPassword.length < 6) {
        errorEl.textContent = 'New password must be at least 6 characters.';
        return;
    }

    try {
        await apiRequest('band/change-password', { currentPassword, newPassword }, 'POST');
        alert('Password changed successfully. You can now use the tool.');
        logout(); // Force re-login to get a new token without the reset flag.
    } catch (error) {
        errorEl.textContent = `Error: ${error.message}`;
    }
}

function initializeApp() {
    let songData = { id: null, title: '', artist: '', audio_url: null, song_blocks: [] };
    let musicalContext = { tuning: 'E_STANDARD', capo: 0, transpose: 0 };
    let chordQueue = [];
    let chordQueueIndex = 0;
    let lastFocusedLyricsBlock = null;
    let mediaRecorder, audioChunks = [];
    let fretSelectionContext = { blockId: null, string: null, position: null };
    let selectedNote = { blockId: null, noteIndex: null };
    let activeResize = { element: null, startY: 0, startHeight: 0, blockId: null };
    let isDraggingNote = false;

    // Element selectors
    const titleInput = document.getElementById('titleInput');
    const artistInput = document.getElementById('artistInput');
    const songBlocksContainer = document.getElementById('song-blocks-container');
    const addBlockButtonsContainer = document.getElementById('add-block-buttons');
    const livePreview = document.getElementById('livePreview');
    const tuningSelector = document.getElementById('tuningSelector');
    const capoFretInput = document.getElementById('capoFretInput');
    const songSelector = document.getElementById('songSelector');
    const saveBtn = document.getElementById('saveBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const statusMessage = document.getElementById('statusMessage');
    const chordPalette = document.querySelector('#sidebar #chordPalette');
    const newChordInput = document.querySelector('#sidebar #newChordInput');
    const addChordBtn = document.querySelector('#sidebar #addChordBtn');
    const transposeDownBtn = document.getElementById('transposeDownBtn');
    const transposeUpBtn = document.getElementById('transposeUpBtn');
    const transposeStatus = document.getElementById('transposeStatus');
    const chordQueueDiv = document.getElementById('chordQueue');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const setlistBtn = document.getElementById('setlistBtn');
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    const recordingStatus = document.getElementById('recordingStatus');
    const audioPlayerContainer = document.getElementById('audioPlayerContainer');
    const audioPlayer = document.getElementById('audioPlayer');
    const setlistModal = document.getElementById('setlistModal');
    const closeSetlistModalBtn = document.getElementById('closeSetlistModalBtn');
    const setlistSelector = document.getElementById('setlistSelector');
    const createSetlistBtn = document.getElementById('createSetlistBtn');
    const addSongToSetlistBtn = document.getElementById('addSongToSetlistBtn');
    const printSetlistBtn = document.getElementById('printSetlistBtn');
    const newSetlistInput = document.getElementById('newSetlistInput');
    const songsInSetlist = document.getElementById('songsInSetlist');
    const currentSetlistTitle = document.getElementById('currentSetlistTitle');
    const setlistDetailsSection = document.getElementById('setlistDetailsSection');
    const saveSetlistDetailsBtn = document.getElementById('saveSetlistDetailsBtn');
    const deleteSetlistBtn = document.getElementById('deleteSetlistBtn');
    const printDrummerSetlistBtn = document.getElementById('printDrummerSetlistBtn');
    const fretSelectionModal = document.getElementById('fret-selection-modal');
    const fretNumberSelector = document.getElementById('fret-number-selector');
    const addFretBtn = document.getElementById('add-fret-btn');
    const cancelFretBtn = document.getElementById('cancel-fret-btn');
    const manageBandBtn = document.getElementById('manageBandBtn');
    
    // Constants
    const TUNINGS = { 
        E_STANDARD: { name: "E Standard", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'E'] }, 
        EB_STANDARD: { name: "Eb Standard", offset: -1, strings: ['d#', 'A#', 'F#', 'C#', 'G#', 'D#'] }, 
        D_STANDARD: { name: "D Standard", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'D'] }, 
        DROP_D: { name: "Drop D", offset: 0, strings: ['e', 'B', 'G', 'D', 'A', 'D'] }, 
        DROP_C: { name: "Drop C", offset: -2, strings: ['d', 'A', 'F', 'C', 'G', 'C'] } 
    };
    const STRING_CONFIG = { 6: { height: 180, stringSpacing: 28 }, 7: { height: 210, stringSpacing: 28 }, 8: { height: 240, stringSpacing: 28 }};
    const FRETBOARD_CONFIG = { frets: 24, width: 8000, nutWidth: 15, fretSpacing: 80, dotFrets: [3, 5, 7, 9, 12, 15, 17, 19, 21, 24], dotRadius: 5, noteRadius: 11 };
    const sharpScale = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    
    function setStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = `text-center text-sm h-4 ${isError ? 'text-red-400' : 'text-gray-400'}`;
        if (message) {
            setTimeout(() => {
                statusMessage.textContent = '';
            }, 3000);
        }
    }

    async function openSetlistManager() {
        setlistModal.classList.remove('hidden');
        await loadSetlists();
        handleSetlistSelection(null);
    }

    async function loadSetlists(selectId = null) {
        try {
            const lists = await apiRequest('setlists');
            setlistSelector.innerHTML = '<option value="">-- Select a Setlist --</option>';
            lists.forEach(list => {
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = list.name;
                setlistSelector.appendChild(option);
            });
            if (selectId) {
                setlistSelector.value = selectId;
                await handleSetlistSelection(selectId);
            }
        } catch (error) {
            setStatus('Failed to load setlists.', true);
        }
    }

    async function handleSetlistSelection(setlistId) {
        if (!setlistId) {
            currentSetlistTitle.textContent = 'Select a setlist';
            setlistDetailsSection.classList.add('hidden');
            songsInSetlist.innerHTML = '';
            addSongToSetlistBtn.disabled = true;
            printSetlistBtn.disabled = true;
            printDrummerSetlistBtn.disabled = true;
            deleteSetlistBtn.disabled = true;
            return;
        }
        try {
            const setlist = await apiRequest(`setlists/${setlistId}`);
            currentSetlistTitle.textContent = setlist.name;
            document.getElementById('setlistVenue').value = setlist.venue || '';
            document.getElementById('setlistDate').value = setlist.event_date ? setlist.event_date.split('T')[0] : '';
            document.getElementById('setlistLogoUrl').value = setlist.logo_url || '';
            document.getElementById('setlistNotes').value = setlist.notes || '';
            setlistDetailsSection.classList.remove('hidden');
            songsInSetlist.innerHTML = '';
            (setlist.songs || []).forEach(song => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center p-2 bg-gray-700 rounded cursor-move';
                li.dataset.songId = song.id;
                li.innerHTML = `<span>${song.title} - <em class="text-gray-400">${song.artist}</em></span><button data-action="remove-song" class="btn btn-danger btn-sm">Remove</button>`;
                songsInSetlist.appendChild(li);
            });
            addSongToSetlistBtn.disabled = !songData.id;
            printSetlistBtn.disabled = false;
            printDrummerSetlistBtn.disabled = false;
            deleteSetlistBtn.disabled = false;
        } catch (error) {
            setStatus(`Failed to load setlist details: ${error.message}`, true);
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
            await apiRequest(`setlists/${setlistId}`, payload, 'PUT');
            setStatus('Setlist details saved!', false);
        } catch (error) {
            setStatus(`Error saving details: ${error.message}`, true);
        }
    }

    async function handleCreateSetlist() {
        const name = newSetlistInput.value.trim();
        if (!name) return alert('Please enter a name for the new setlist.');
        try {
            const newSetlist = await apiRequest('setlists', { name }, 'POST');
            newSetlistInput.value = '';
            setStatus('Setlist created!', false);
            await loadSetlists(newSetlist.id);
        } catch (error) {
            setStatus(`Error creating setlist: ${error.message}`, true);
        }
    }

    async function handleDeleteSetlist() {
        const setlistId = setlistSelector.value;
        const setlistName = setlistSelector.options[setlistSelector.selectedIndex].text;
        if (!setlistId) return;
        if (confirm(`ARE YOU SURE you want to permanently delete the setlist "${setlistName}"? This cannot be undone.`)) {
            try {
                await apiRequest(`setlists/${setlistId}`, null, 'DELETE');
                setStatus(`Setlist "${setlistName}" deleted.`, false);
                await loadSetlists();
                handleSetlistSelection(null);
            } catch(error) {
                setStatus(`Failed to delete setlist: ${error.message}`, true);
            }
        }
    }
    
    async function handleAddSongToSetlist() {
        const setlistId = setlistSelector.value;
        if (!songData.id) return alert('Please save the current song before adding it to a setlist.');
        if (!setlistId) return alert('Please select a setlist first.');
        try {
            await apiRequest(`setlists/${setlistId}/songs`, { song_id: songData.id }, 'POST');
            setStatus(`'${songData.title}' added to setlist.`, false);
            await handleSetlistSelection(setlistId);
        } catch(error) {
            setStatus(`Failed to add song: ${error.message}`, true);
        }
    }
    
    async function handleRemoveSongFromSetlist(songId) {
        const setlistId = setlistSelector.value;
        if (!setlistId || !songId) return;
        if (confirm("Are you sure you want to remove this song from the setlist?")) {
            try {
                await apiRequest(`setlists/${setlistId}/songs/${songId}`, null, 'DELETE');
                setStatus(`Song removed from setlist.`, false);
                await handleSetlistSelection(setlistId);
            } catch(error) {
                setStatus(`Failed to remove song: ${error.message}`, true);
            }
        }
    }
    
    async function handlePrintSetlist(drummerMode = false) {
        const setlistId = setlistSelector.value;
        if (!setlistId) return;

        setStatus('Generating PDF...');
        try {
            const setlist = await apiRequest(`setlists/${setlistId}`);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const leftMargin = 15;
            const rightMargin = doc.internal.pageSize.getWidth() - 15;
            let y = 20;
            const pageHeight = doc.internal.pageSize.getHeight();
            const marginBottom = 20;
            const maxWidth = rightMargin - leftMargin;

            const getImageDataUrl = async (url) => {
                if (!url) return Promise.resolve(null);
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = () => { console.error('Failed to load watermark image.'); resolve(null); };
                    img.src = url;
                });
            };
            
            const logoDataUrl = await getImageDataUrl(setlist.logo_url);
            
            const addWatermarkToPage = () => {
                if (logoDataUrl) {
                    doc.setGState(new doc.GState({opacity: 0.1}));
                    doc.addImage(logoDataUrl, 'PNG', rightMargin - 20, 10, 20, 20);
                    doc.setGState(new doc.GState({opacity: 1.0}));
                }
            };

            const checkPageBreak = (neededHeight) => {
                if (y + neededHeight > pageHeight - marginBottom) {
                    addWatermarkToPage(); doc.addPage(); y = 20; addWatermarkToPage();
                }
            };

            addWatermarkToPage();
            doc.setFontSize(26);
            doc.text(setlist.name, doc.internal.pageSize.getWidth() / 2, y, { align: 'center', maxWidth });
            y += 15;
            doc.setFontSize(16);
            if (setlist.venue) { doc.text(setlist.venue, doc.internal.pageSize.getWidth() / 2, y, { align: 'center', maxWidth }); y += 8; }
            if (setlist.event_date) { doc.text(new Date(setlist.event_date).toLocaleDateString(undefined, { timeZone: 'UTC' }), doc.internal.pageSize.getWidth() / 2, y, { align: 'center' }); }
            y += 15;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Song List:', leftMargin, y);
            y += 8;
            doc.setFont(undefined, 'normal');
            (setlist.songs || []).forEach((song, index) => {
                checkPageBreak(8);
                const titleText = `${index + 1}. ${song.title} (${song.artist || 'Unknown'})`;
                const splitTitle = doc.splitTextToSize(titleText, maxWidth - 5);
                doc.text(splitTitle, leftMargin + 5, y);
                y += splitTitle.length * 7;
            });

            for (const song of (setlist.songs || [])) {
                addWatermarkToPage(); doc.addPage(); y = 20; addWatermarkToPage();
                doc.setFontSize(18); doc.setFont(undefined, 'bold');
                doc.text(song.title, leftMargin, y, { maxWidth });
                y += 8;
                doc.setFontSize(14); doc.setFont(undefined, 'italic');
                doc.text(song.artist || 'Unknown Artist', leftMargin, y, { maxWidth });
                y += 12;
                
                const songBlocks = (typeof song.song_blocks === 'string') ? JSON.parse(song.song_blocks || '[]') : (song.song_blocks || []);
                for (const block of songBlocks) {
                    let blockToRender = block.type === 'reference' ? (songBlocks.find(b => b.id === block.originalId) || block) : block;
                    if (!blockToRender || (!blockToRender.content && (!blockToRender.data || !blockToRender.data.notes))) continue;
                    
                    if(drummerMode && !(blockToRender.type === 'lyrics' || blockToRender.type === 'drum_tab')) continue;
                    if(!drummerMode && blockToRender.type === 'drum_tab') continue;
                    
                    checkPageBreak(12);
                    doc.setFont(undefined, 'bold'); doc.setFontSize(12);
                    doc.text(block.label, leftMargin, y, { maxWidth });
                    y += 7;
                    
                    doc.setFont('Courier', 'normal'); doc.setFontSize(10);
                    const lineHeight = 5;
                    
                    const contentToRender = blockToRender.type === 'tab' ? renderTransposedTab(blockToRender) : (blockToRender.content || '');

                    for (const line of contentToRender.split('\n')) {
                        if (blockToRender.type === 'lyrics') {
                            const parsed = parseLineForRender(line.replace(/&nbsp;/g, ' '));
                            if (!drummerMode) {
                                checkPageBreak(lineHeight * 2.5);
                                doc.setTextColor(60, 60, 60);
                                doc.text(parsed.chordLine, leftMargin, y, { maxWidth });
                                y += lineHeight;
                            } else { checkPageBreak(lineHeight * 1.5); }
                            doc.setTextColor(0, 0, 0);
                            const splitLyrics = doc.splitTextToSize(parsed.lyricLine, maxWidth);
                            doc.text(splitLyrics, leftMargin, y);
                            y += (splitLyrics.length * lineHeight) + (lineHeight * 0.5);
                        } else if (blockToRender.type === 'tab' || blockToRender.type === 'drum_tab') {
                            const splitText = doc.splitTextToSize(line, maxWidth);
                            checkPageBreak(splitText.length * lineHeight);
                            doc.setTextColor(0,0,0);
                            doc.text(splitText, leftMargin, y);
                            y += (splitText.length * lineHeight) + (lineHeight * 0.5);
                        }
                    }
                    y += lineHeight;
                }
            }
            addWatermarkToPage();
            doc.save(`${setlist.name.replace(/\s/g, '_')}${drummerMode ? '_Drummer' : ''}.pdf`);
            setStatus('PDF generated.', false);
        } catch (error) {
            setStatus(`Failed to generate PDF: ${error.message}`, true);
            console.error("PDF generation error:", error);
        }
    }

    function renderSongBlocks() {
        songBlocksContainer.innerHTML = '';
        (songData.song_blocks || []).forEach(block => songBlocksContainer.appendChild(createBlockElement(block)));
        renderAddBlockButtons();
        renderPreview();
        initializeSortable();
    }

    function createBlockElement(block) {
        const div = document.createElement('div');
        div.className = 'song-block';
        div.dataset.blockId = block.id;
        let contentHtml = '', headerControls = '';
        const drumPlaceholder = `HH|x-x-x-x-x-x-x-x-|\nSD|----o-------o---|\nBD|o-------o-------|`;

        if (block.type === 'lyrics') {
            contentHtml = `<textarea class="form-textarea lyrics-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="Enter lyrics and [chords]...">${block.content || ''}</textarea><div class="resize-handle"></div>`;
        } else if (block.type === 'tab') {
            contentHtml = `<div class="fretboard-wrapper"><div id="fretboard-${block.id}"></div></div>`;
            const isEditMode = block.editMode || false;
            const editButtonClass = isEditMode ? 'btn-edit-mode' : 'btn-secondary';
            headerControls = `<button class="btn ${editButtonClass} btn-sm" data-action="edit-tab">${isEditMode ? 'Done Editing' : 'Edit'}</button>`;
        } else if (block.type === 'drum_tab') {
            contentHtml = `<textarea class="form-textarea drum-tab-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="${drumPlaceholder}">${block.content || ''}</textarea><div class="resize-handle"></div>`;
        } else if (block.type === 'reference') {
            const originalBlock = songData.song_blocks.find(b => b.id === block.originalId);
            contentHtml = `<div class="p-4 bg-gray-800 rounded-md text-gray-400 italic">Reference to: ${originalBlock ? originalBlock.label : 'Unknown Section'}</div>`;
        }
        div.innerHTML = `<div class="block-header"><div class="flex items-center gap-4"><div class="flex items-center gap-2"><span class="font-bold">${block.label}</span><span class="text-xs text-gray-400">(${block.type.replace('_', ' ')})</span></div></div><div class="flex items-center gap-2">${headerControls}<button class="btn-sm text-xs hover:underline" data-action="rename">Rename</button><button class="btn-sm text-red-400 hover:underline" data-action="delete">Delete</button></div></div><div class="block-content">${contentHtml}</div>`;
        if (block.type === 'tab') setTimeout(() => drawFretboard(block.id), 0);
        return div;
    }

    function renderAddBlockButtons() {
        const createdSections = songData.song_blocks.filter(b => b.type !== 'reference');
        let referenceButtonsHtml = '';
        if (createdSections.length > 0) {
            referenceButtonsHtml = `<div class="relative inline-block text-left"><button id="insert-ref-btn" class="btn btn-secondary">Insert Existing Section</button><div id="ref-dropdown" class="hidden origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10"><div class="py-1" role="menu" aria-orientation="vertical">${createdSections.map(b => `<a href="#" class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600" data-original-id="${b.id}" role="menuitem">${b.label}</a>`).join('')}</div></div></div>`;
        }
        addBlockButtonsContainer.innerHTML = `<button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Verse </button><button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Chorus </button><button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Bridge </button><button class="btn btn-secondary" data-action="add" data-type="tab"> + Tab Section </button><button class="btn btn-secondary" data-action="add" data-type="drum_tab"> + Drum Tab </button>${referenceButtonsHtml}`;
    }
    
    function renderPreview() {
        let previewHtml = '';
        (songData.song_blocks || []).forEach(block => {
            let blockToRender = block.type === 'reference' ? (songData.song_blocks.find(b => b.id === block.originalId) || block) : block;
            previewHtml += `<h4 class="text-lg font-bold mt-4 text-gray-400">${block.label}</h4>`;
            if (!blockToRender) return;
            
            if (blockToRender.type === 'lyrics') {
                (blockToRender.content || '').split('\n').forEach(line => {
                    const parsed = parseLineForRender(line);
                    previewHtml += `<div class="live-preview-chords">${parsed.chordLine}</div><div>${parsed.lyricLine}</div>`;
                });
            } else if (blockToRender.type === 'tab') {
                previewHtml += `<div class="tab-preview">${renderTransposedTab(blockToRender)}</div>`;
            } else if (blockToRender.type === 'drum_tab') {
                previewHtml += `<div class="tab-preview">${blockToRender.content || ''}</div>`;
            }
        });
        livePreview.innerHTML = previewHtml;
    }

    function getFretFromClick(evt, svgEl) {
        const wrapper = svgEl.closest('.fretboard-wrapper');
        if (!wrapper) return null;
        const svgRect = svgEl.getBoundingClientRect();
        const x = evt.clientX - svgRect.left + wrapper.scrollLeft;
        const y = evt.clientY - svgRect.top;
        const blockId = svgEl.id.split('-').pop();
        const block = songData.song_blocks.find(b => b.id === blockId);
        if (!block) return null;
        const numStrings = block.strings || 6;
        const stringConfig = STRING_CONFIG[numStrings];
        const stringIndex = Math.floor(y / stringConfig.stringSpacing);
        const rawFret = (x - FRETBOARD_CONFIG.nutWidth) / FRETBOARD_CONFIG.fretSpacing;
        const fret = Math.max(0, Math.round(rawFret));
        if (stringIndex >= 0 && stringIndex < numStrings && fret <= FRETBOARD_CONFIG.frets) {
            return { string: stringIndex, fret, position: x };
        }
        return null;
    }

    function drawFretboard(blockId) {
        const container = document.getElementById(`fretboard-${blockId}`);
        if (!container) return;
        const block = songData.song_blocks.find(b => b.id === blockId);
        if (!block) return;
        const numStrings = block.strings || 6;
        const stringConfig = STRING_CONFIG[numStrings];
        const { frets, width, nutWidth, fretSpacing, dotFrets, dotRadius } = FRETBOARD_CONFIG;
        const { height, stringSpacing } = stringConfig;
        
        let svgHTML = `<svg id="fretboard-svg-${blockId}" width="${width}" height="${height}" style="min-width: 100%;"><rect class="fretboard-bg" width="${width}" height="${height}" fill="#2d3748" />`;
        for (let i = 0; i < numStrings; i++) {
            svgHTML += `<line class="fretboard-string" x1="0" y1="${stringSpacing / 2 + i * stringSpacing}" x2="${width}" y2="${stringSpacing / 2 + i * stringSpacing}" />`;
        }
        svgHTML += `<rect class="fretboard-nut" x="0" y="0" width="${nutWidth}" height="${height}" fill="#1e1e1e" />`;
        for (let i = 1; i <= frets; i++) {
            svgHTML += `<line class="fretboard-fret" x1="${nutWidth + i * fretSpacing}" y1="0" x2="${nutWidth + i * fretSpacing}" y2="${height}" stroke="#4a5563" stroke-width="1" />`;
        }
        dotFrets.forEach(fret => {
            const x = nutWidth + (fret - 0.5) * fretSpacing;
            if (fret % 12 === 0) {
                svgHTML += `<circle class="fretboard-dot" cx="${x}" cy="${stringSpacing * (numStrings / 4)}" r="${dotRadius}" fill="#555" /><circle class="fretboard-dot" cx="${x}" cy="${height - (stringSpacing * (numStrings / 4))}" r="${dotRadius}" fill="#555" />`;
            } else {
                svgHTML += `<circle class="fretboard-dot" cx="${x}" cy="${height / 2}" r="${dotRadius}" fill="#555"/>`;
            }
        });
        svgHTML += `<g id="fretboard-notes-group-${blockId}"></g></svg>`;
        container.innerHTML = svgHTML;
        drawNotesOnFretboard(blockId);
        const svgEl = document.getElementById(`fretboard-svg-${blockId}`);
        if (svgEl) attachFretboardListeners(svgEl);
    }

    function drawNotesOnFretboard(blockId) {
        const block = songData.song_blocks.find(b => b.id === blockId);
        const notesGroup = document.getElementById(`fretboard-notes-group-${blockId}`);
        if (!notesGroup || !block || block.type !== 'tab') return;
        notesGroup.innerHTML = '';
        const numStrings = block.strings || 6;
        const stringConfig = STRING_CONFIG[numStrings];
        const totalOffset = (TUNINGS[musicalContext.tuning]?.offset ?? 0) + musicalContext.capo;
        (block.data?.notes || []).forEach((note, index) => {
            if (note.string >= numStrings) return;
            const transposedFret = note.fret - totalOffset;
            if (transposedFret < 0) return;
            
            const y = stringConfig.stringSpacing / 2 + note.string * stringConfig.stringSpacing;
            const x = note.position;
            
            const isSelected = selectedNote.blockId === blockId && selectedNote.noteIndex === index;

            notesGroup.innerHTML += `<g class="note-group"><circle class="fretboard-note ${isSelected ? 'selected' : ''}" cx="${x}" cy="${y}" r="${FRETBOARD_CONFIG.noteRadius}" data-note-index="${index}"/><text class="fretboard-note-text" x="${x}" y="${y}">${transposedFret}</text></g>`;
        });
    }
    
    function renderTransposedTab(tabBlock) {
        if (!tabBlock.data || !tabBlock.data.notes || tabBlock.data.notes.length === 0) return 'No tab data.';
        const numStrings = tabBlock.strings || 6;
        const tuningInfo = TUNINGS[musicalContext.tuning];
        const stringNames = tuningInfo?.strings?.slice(0, numStrings) || STRING_CONFIG[6].names;
        const totalOffset = (tuningInfo?.offset ?? 0) + musicalContext.capo + musicalContext.transpose;
        const positionMap = new Map();
        const sortedNotes = [...tabBlock.data.notes].sort((a,b) => a.position - b.position);

        sortedNotes.forEach(note => {
            if (note.string >= numStrings) return;
            const transposedFret = note.fret - totalOffset;
            if (transposedFret < 0) return;
            const charPosition = Math.floor((note.position - FRETBOARD_CONFIG.nutWidth) / 10);
            if (charPosition < 0) return;
            if (!positionMap.has(charPosition)) positionMap.set(charPosition, Array(numStrings).fill(null));
            positionMap.get(charPosition)[note.string] = transposedFret;
        });
        if (positionMap.size === 0) return 'Notes out of range for current settings.';
        const sortedPositions = [...positionMap.keys()].sort((a,b) => a - b);
        const lines = stringNames.map(name => `${name.padEnd(2, ' ')}|`);
        let lastCharPos = 0;
        
        sortedPositions.forEach(charPos => {
            const notesAtPos = positionMap.get(charPos);
            const padding = charPos - lastCharPos;
            if (padding > 1) lines.forEach((_, i) => lines[i] += '-'.repeat(padding - 1));
            
            let maxFretWidth = 1;
            notesAtPos.forEach(fret => { if (fret !== null) maxFretWidth = Math.max(maxFretWidth, String(fret).length) });
            
            lines.forEach((_, i) => { lines[i] += (notesAtPos[i] !== null) ? String(notesAtPos[i]).padEnd(maxFretWidth, '-') : '-'.repeat(maxFretWidth) });
            lastCharPos = charPos + maxFretWidth -1;
        });
        return lines.join('\n');
    }

    function updateBlockData(blockId, field, value, height) {
        const block = songData.song_blocks.find(b => b.id === blockId);
        if (block) {
            if (field) block[field] = value;
            if (height) block.height = height;
            if(field === 'content') renderPreview();
        }
    }
    
    async function loadSong(id) {
        if (!id || id === 'new') { 
            initializeNewSong(); 
            return; 
        }
        setStatus('Loading song...');
        try {
            const data = await apiRequest(`lyric-sheets/${id}`);
            songData = { id: data.id, title: data.title || '', artist: data.artist || '', audio_url: data.audio_url, song_blocks: Array.isArray(data.song_blocks) ? data.song_blocks : [] };
            titleInput.value = songData.title;
            artistInput.value = songData.artist;
            if (songData.audio_url) {
                audioPlayer.src = songData.audio_url;
                audioPlayerContainer.classList.remove('hidden');
            } else {
                audioPlayerContainer.classList.add('hidden');
            }
            renderSongBlocks();
            setStatus('Song loaded.');
        } catch (error) {
            setStatus(`Error loading song: ${error.message}`, true);
            initializeNewSong();
        }
    }

    function initializeNewSong() {
        songData = { id: null, title: '', artist: '', audio_url: null, song_blocks: [{ id: `block_${Date.now()}`, type: 'lyrics', label: 'Verse 1', content: '', height: 100 }] };
        titleInput.value = '';
        artistInput.value = '';
        audioPlayerContainer.classList.add('hidden');
        songSelector.value = 'new';
        renderSongBlocks();
    }

    async function handleSave() {
        saveBtn.disabled = true;
        setStatus('Saving...');
        try {
            songData.title = titleInput.value || 'Untitled';
            songData.artist = artistInput.value || 'Unknown Artist';
            const payload = songData;
            const savedSong = songData.id ? await apiRequest(`lyric-sheets/${songData.id}`, payload, 'PUT') : await apiRequest('lyric-sheets', payload, 'POST');
            songData.id = savedSong.id;
            setStatus('Saved successfully!');
            if (!songSelector.querySelector(`option[value="${savedSong.id}"]`)) { 
                await loadSheetList(savedSong.id);
            } else {
                // Update the text in case the title changed
                songSelector.querySelector(`option[value="${savedSong.id}"]`).textContent = songData.title;
                songSelector.value = savedSong.id;
            }
        } catch (error) { 
            setStatus(`Save failed: ${error.message}`, true); 
        } finally {
            saveBtn.disabled = false;
        }
    }
    
    function initializeSortable() {
        if (songBlocksContainer.sortableInstance) songBlocksContainer.sortableInstance.destroy();
        songBlocksContainer.sortableInstance = new Sortable(songBlocksContainer, {
            animation: 150, handle: '.block-header', onEnd: (evt) => {
                const [movedItem] = songData.song_blocks.splice(evt.oldIndex, 1);
                songData.song_blocks.splice(evt.newIndex, 0, movedItem);
                renderPreview();
            }
        });
        if(songsInSetlist) {
            new Sortable(songsInSetlist, {
                animation: 150, onEnd: async (evt) => {
                    const setlistId = setlistSelector.value;
                    if(!setlistId) return;
                    const items = evt.from.querySelectorAll('li');
                    const songIds = Array.from(items).map(item => item.dataset.songId);
                    try {
                        await apiRequest(`setlists/${setlistId}/songs`, { song_ids: songIds }, 'PUT');
                        setStatus('Setlist order saved.', false);
                    } catch (error) {
                        setStatus('Failed to reorder setlist.', true);
                    }
                }
            });
        }
    }
    
    function parseLineForRender(rawLine) { let chordLine = ''; let lyricLine = ''; const regex = /(\[[^\]]+\])|([^\[]+)/g; let match; if (!rawLine.trim()) return { chordLine: ' ', lyricLine: ' ' }; while ((match = regex.exec(rawLine)) !== null) { if (match[1]) { const chordName = match[1].slice(1, -1); chordLine += chordName; lyricLine += ' '.repeat(chordName.length); } if (match[2]) { chordLine += ' '.repeat(match[2].length); lyricLine += match[2]; } } return { chordLine: chordLine.trimEnd() || ' ', lyricLine: lyricLine.trimEnd() || ' ' }; }
    function populateTuningSelector() { for (const key in TUNINGS) { const option = document.createElement('option'); option.value = key; option.textContent = TUNINGS[key].name; tuningSelector.appendChild(option); } }
    async function loadSheetList(selectId = null) { try { const songs = await apiRequest('lyric-sheets'); songs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)); songSelector.innerHTML = '<option value="new">-- Create New Song --</option>'; songs.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title || 'Untitled'; songSelector.appendChild(o); }); if (selectId) { songSelector.value = selectId; } } catch (e) { setStatus('Failed to load songs.', true); } }
    async function handleDelete() { if (!songData.id) { setStatus("Cannot delete an unsaved song.", true); return; } if (confirm(`Are you sure you want to delete "${songData.title}"?`)) { try { setStatus('Deleting...'); await apiRequest(`lyric-sheets/${songData.id}`, null, 'DELETE'); setStatus('Song deleted.'); await loadSheetList(); await initializeNewSong(); } catch (e) { setStatus(`Failed to delete: ${e.message}`, true); } } }
    function transposeChord(chord, amount) { const regex = /^([A-G][b#]?)(.*)/; const match = chord.match(regex); if (!match) return chord; let note = match[1]; let index = sharpScale.indexOf(note); if (index === -1) { const flatNotes = { 'Bb':'A#', 'Db':'C#', 'Eb':'D#', 'Gb':'F#', 'Ab':'G#'}; note = flatNotes[note] || note; index = sharpScale.indexOf(note); } if (index === -1) return chord; const newIndex = (index + amount + 12) % 12; return sharpScale[newIndex] + match[2]; }
    function updateTransposeStatus(steps) { musicalContext.transpose = steps; transposeStatus.textContent = steps > 0 ? `+${steps}` : steps; }
    function handleTranspose(amount) {
        updateTransposeStatus(musicalContext.transpose + amount);
        songData.song_blocks.forEach(block => {
            if (block.type === 'lyrics' && block.content) {
                block.content = block.content.replace(/\[([^\]]+)\]/g, (match, chord) => `[${transposeChord(chord, amount)}]`);
            }
        });
        renderSongBlocks();
    }
    function renderChordQueue() {
        chordQueueDiv.innerHTML = '';
        if (chordQueue.length === 0) {
            document.querySelectorAll('.lyrics-block').forEach(el => el.classList.remove('placement-mode'));
            clearQueueBtn.disabled = true; return;
        }
        document.querySelectorAll('.lyrics-block').forEach(el => el.classList.add('placement-mode'));
        clearQueueBtn.disabled = false;
        chordQueue.forEach((name, index) => {
            const pill = document.createElement('span');
            pill.className = `queue-pill ${index === chordQueueIndex ? 'next' : ''}`;
            pill.textContent = name;
            chordQueueDiv.appendChild(pill);
        });
    }
    async function loadChords() { try { const chords = await apiRequest('chords'); chordPalette.innerHTML = ''; chords.forEach(c => { const btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-sm'; btn.onclick = (e) => { if (e.ctrlKey || e.metaKey) { chordQueue.push(c.name); renderChordQueue(); } else if (lastFocusedLyricsBlock) { const t = `[${c.name}]`; const p = lastFocusedLyricsBlock.selectionStart; lastFocusedLyricsBlock.value = lastFocusedLyricsBlock.value.slice(0, p) + t + lastFocusedLyricsBlock.value.slice(p); lastFocusedLyricsBlock.focus(); lastFocusedLyricsBlock.setSelectionRange(p + t.length, p + t.length); updateBlockData(lastFocusedLyricsBlock.closest('.song-block').dataset.blockId, 'content', lastFocusedLyricsBlock.value); }}; btn.textContent = c.name; chordPalette.appendChild(btn); }); } catch (e) { setStatus('Failed to load chords.', true); } }
    async function handleAddChord() { const name = newChordInput.value.trim(); if (!name) return; try { await apiRequest('chords', { name }, 'POST'); newChordInput.value = ''; setStatus(`'${name}' added.`); await loadChords(); } catch (e) { setStatus(e.message, true); } }
    async function startRecording() { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorder = new MediaRecorder(stream); mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); }; mediaRecorder.onstop = handleSaveRecording; audioChunks = []; mediaRecorder.start(); recordBtn.textContent = 'Recording...'; recordBtn.classList.add('recording'); recordBtn.disabled = true; stopBtn.disabled = false; recordingStatus.textContent = 'Recording in progress.'; } catch (err) { setStatus('Microphone access denied.', true); console.error("Error accessing microphone:", err); } }
    function stopRecording() { if(mediaRecorder) mediaRecorder.stop(); recordBtn.textContent = 'Record'; recordBtn.classList.remove('recording'); recordBtn.disabled = false; stopBtn.disabled = true; recordingStatus.textContent = 'Processing...'; }
    async function handleSaveRecording() { setStatus('Audio upload not yet implemented.', true); }
    
    function attachFretboardListeners(svgEl) {
        const blockId = svgEl.id.split('-').pop();
        const block = songData.song_blocks.find(b => b.id === blockId);
        if (!block) return;
        
        svgEl.addEventListener('mousedown', (e) => {
            isDraggingNote = false; 
            if (block.editMode && e.target.closest('.note-group')) {
                isDraggingNote = true;
                const noteGroup = e.target.closest('.note-group');
                const noteIndex = parseInt(noteGroup.querySelector('.fretboard-note').dataset.noteIndex, 10);
                selectedNote = { blockId, noteIndex };
                drawNotesOnFretboard(blockId);
            }
        });
        
        svgEl.addEventListener('click', (e) => {
            if (isDraggingNote) { isDraggingNote = false; return; }
            const isNoteClick = e.target.closest('.note-group');
            if (block.editMode) {
                if (isNoteClick) {
                    const clickedNoteIndex = parseInt(isNoteClick.querySelector('.fretboard-note').dataset.noteIndex, 10);
                    if (selectedNote.blockId === blockId && selectedNote.noteIndex === clickedNoteIndex) {
                        block.data.notes.splice(clickedNoteIndex, 1);
                        selectedNote = { blockId: null, noteIndex: null };
                    } else {
                        selectedNote = { blockId, noteIndex: clickedNoteIndex };
                    }
                } else { 
                    selectedNote = { blockId: null, noteIndex: null };
                }
                drawNotesOnFretboard(blockId);
            } else {
                if (!isNoteClick) {
                    const clickData = getFretFromClick(e, svgEl);
                    if (clickData) {
                        fretSelectionContext = { blockId, string: clickData.string, position: clickData.position };
                        fretNumberSelector.innerHTML = '';
                        for (let i = 0; i <= FRETBOARD_CONFIG.frets; i++) {
                            const option = new Option(i, i);
                            if (i === clickData.fret) option.selected = true;
                            fretNumberSelector.appendChild(option);
                        }
                        fretSelectionModal.style.left = `${e.clientX + 5}px`;
                        fretSelectionModal.style.top = `${e.clientY + 5}px`;
                        fretSelectionModal.classList.remove('hidden');
                    }
                }
            }
        });
    }

    function confirmFretSelection() {
        const { blockId, string, position } = fretSelectionContext;
        const fret = parseInt(fretNumberSelector.value, 10);
        const block = songData.song_blocks.find(b => b.id === blockId);

        if(block && string !== null && position !== null && fret >= 0) {
            const totalOffset = (TUNINGS[musicalContext.tuning]?.offset ?? 0) + musicalContext.capo;
            if (!block.data) block.data = { notes: [] };
            block.data.notes.push({ string, fret: fret + totalOffset, position });
            drawNotesOnFretboard(blockId);
            renderPreview();
        }
        fretSelectionModal.classList.add('hidden');
    }
    
    const user = getUserPayload();
    if (user && (user.role === 'admin' || user.role === 'band_admin')) {
        manageBandBtn.style.display = 'block';
    }

    const musicalInputs = [tuningSelector, capoFretInput];
    musicalInputs.forEach(el => el.addEventListener('input', () => {
        musicalContext.tuning = tuningSelector.value;
        musicalContext.capo = parseInt(capoFretInput.value, 10) || 0;
        renderSongBlocks();
    }));
    transposeUpBtn.addEventListener('click', () => handleTranspose(1));
    transposeDownBtn.addEventListener('click', () => handleTranspose(-1));
    saveBtn.addEventListener('click', handleSave);
    deleteBtn.addEventListener('click', handleDelete);
    addChordBtn.addEventListener('click', handleAddChord);
    newChordInput.addEventListener('keyup', (e) => e.key === 'Enter' && handleAddChord());
    clearQueueBtn.addEventListener('click', () => { chordQueue = []; chordQueueIndex = 0; renderChordQueue(); });
    songBlocksContainer.addEventListener('focusin', e => { if (e.target.classList.contains('lyrics-block')) lastFocusedLyricsBlock = e.target; });
    songBlocksContainer.addEventListener('input', e => { if (e.target.dataset.field) { const blockId = e.target.closest('.song-block').dataset.blockId; updateBlockData(blockId, 'content', e.target.value); } });
    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    songSelector.addEventListener('change', async () => { await loadSong(songSelector.value); });
    setlistBtn.addEventListener('click', openSetlistManager);
    closeSetlistModalBtn.addEventListener('click', () => setlistModal.classList.add('hidden'));
    setlistSelector.addEventListener('change', (e) => handleSetlistSelection(e.target.value));
    saveSetlistDetailsBtn.addEventListener('click', handleSaveSetlistDetails);
    createSetlistBtn.addEventListener('click', handleCreateSetlist);
    addSongToSetlistBtn.addEventListener('click', handleAddSongToSetlist);
    printSetlistBtn.addEventListener('click', () => handlePrintSetlist(false));
    printDrummerSetlistBtn.addEventListener('click', () => handlePrintSetlist(true));
    deleteSetlistBtn.addEventListener('click', handleDeleteSetlist);
    addFretBtn.addEventListener('click', confirmFretSelection);
    cancelFretBtn.addEventListener('click', () => fretSelectionModal.classList.add('hidden'));
    songsInSetlist.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'remove-song') {
            const songId = e.target.closest('li').dataset.songId;
            handleRemoveSongFromSetlist(songId);
        }
    });

    document.addEventListener('mousemove', e => {
        if (activeResize.element) {
            document.body.style.cursor = 'ns-resize';
            const height = activeResize.startHeight + e.clientY - activeResize.startY;
            activeResize.element.style.height = `${Math.max(50, height)}px`;
        }
        if (isDraggingNote && selectedNote.blockId) {
            const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
            const note = block?.data?.notes[selectedNote.noteIndex];
            if (note) {
                const svg = document.getElementById(`fretboard-svg-${selectedNote.blockId}`);
                const clickData = getFretFromClick(e, svg);
                if (clickData) {
                   note.position = clickData.position;
                   note.string = clickData.string;
                   drawNotesOnFretboard(selectedNote.blockId);
                }
            }
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (activeResize.element) {
            const newHeight = activeResize.element.offsetHeight;
            updateBlockData(activeResize.blockId, null, null, newHeight);
            activeResize = { element: null, startY: 0, startHeight: 0, blockId: null };
            document.body.style.cursor = '';
        }
        if(isDraggingNote) {
            const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
            const note = block?.data?.notes[selectedNote.noteIndex];
            if (note) {
                 const svg = document.getElementById(`fretboard-svg-${selectedNote.blockId}`);
                 const wrapper = svg.closest('.fretboard-wrapper');
                 const svgRect = svg.getBoundingClientRect();
                 const x = event.clientX - svgRect.left + wrapper.scrollLeft;
                 const rawFret = (x - FRETBOARD_CONFIG.nutWidth) / FRETBOARD_CONFIG.fretSpacing;
                 const finalFret = Math.max(0, Math.round(rawFret));
                 const totalOffset = (TUNINGS[musicalContext.tuning]?.offset ?? 0) + musicalContext.capo;
                 note.fret = finalFret + totalOffset;
            }
            isDraggingNote = false;
            renderPreview(); 
        }
    });

    songBlocksContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            const blockEl = e.target.closest('.song-block');
            const textarea = blockEl.querySelector('textarea');
            activeResize = {
                element: textarea,
                startY: e.clientY,
                startHeight: textarea.offsetHeight,
                blockId: blockEl.dataset.blockId
            };
        }
    });

    songBlocksContainer.addEventListener('click', (e) => {
        const blockEl = e.target.closest('.song-block');
        if (!blockEl) return;
        const blockId = blockEl.dataset.blockId;
        const block = songData.song_blocks.find(b => b.id === blockId);

        if (e.target.classList.contains('lyrics-block') && chordQueue.length > 0) {
            e.preventDefault(); const textarea = e.target; const chordToPlace = chordQueue[chordQueueIndex]; 
            const t = `[${chordToPlace}]`; const p = textarea.selectionStart; 
            textarea.value = textarea.value.slice(0, p) + t + textarea.value.slice(p); 
            textarea.focus(); const newPos = p + t.length; 
            textarea.setSelectionRange(newPos, newPos); 
            chordQueueIndex = (chordQueueIndex + 1) % chordQueue.length; 
            updateBlockData(blockId, 'content', textarea.value); renderChordQueue(); 
        } else if (e.target.dataset.action === 'delete') { 
            if (confirm('Are you sure?')) { songData.song_blocks = songData.song_blocks.filter(b => b.id !== blockId && b.originalId !== blockId); renderSongBlocks(); }
        } else if (e.target.dataset.action === 'rename') { 
            const newLabel = prompt('Enter new label:', block.label); if (newLabel) { block.label = newLabel; renderSongBlocks(); }
        } else if (e.target.dataset.action === 'edit-tab') {
            const button = e.target;
            block.editMode = !block.editMode;
            button.textContent = block.editMode ? 'Done Editing' : 'Edit';
            button.classList.toggle('btn-secondary');
            button.classList.toggle('btn-edit-mode');
            if (!block.editMode && selectedNote.blockId === blockId) {
                selectedNote = {blockId: null, noteIndex: null};
                drawNotesOnFretboard(blockId);
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!selectedNote.blockId || selectedNote.noteIndex === null) return;
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            const block = songData.song_blocks.find(b => b.id === selectedNote.blockId);
            if (block && block.data && block.data.notes && block.data.notes[selectedNote.noteIndex]) {
                block.data.notes.splice(selectedNote.noteIndex, 1);
                const oldBlockId = selectedNote.blockId;
                selectedNote = { blockId: null, noteIndex: null };
                drawNotesOnFretboard(oldBlockId);
                renderPreview();
            }
        }
    });

    addBlockButtonsContainer.addEventListener('click', e => {
        const target = e.target;
        if (target.id === 'insert-ref-btn') { document.getElementById('ref-dropdown').classList.toggle('hidden'); }
        else if (target.closest('#ref-dropdown')) { const originalId = target.dataset.originalId; const originalBlock = songData.song_blocks.find(b => b.id === originalId); if(originalBlock) { songData.song_blocks.push({ id: `block_${Date.now()}`, type: 'reference', label: `Reference to ${originalBlock.label}`, originalId: originalId }); renderSongBlocks(); } document.getElementById('ref-dropdown').classList.add('hidden'); }
        else if (target.dataset.action === 'add') {
            const type = target.dataset.type;
            const baseLabel = target.textContent.trim().replace('+', '').trim();
            const count = songData.song_blocks.filter(b => b.label.startsWith(baseLabel)).length + 1;
            const label = `${baseLabel} ${count}`;
            const newBlock = { id: `block_${Date.now()}`, type, label, height: 100 };
            if (type === 'lyrics' || type === 'drum_tab') newBlock.content = '';
            if (type === 'tab') { newBlock.data = { notes: [] }; newBlock.strings = 6; newBlock.editMode = false; }
            songData.song_blocks.push(newBlock);
            renderSongBlocks();
        }
    });
    
    (async function main(){
        populateTuningSelector(); 
        await loadSheetList();
        if(songSelector.value === 'new') {
            initializeNewSong();
        }
        await loadChords();
        initializeSortable();
    })();
}
    </script>
</body>
</html>
