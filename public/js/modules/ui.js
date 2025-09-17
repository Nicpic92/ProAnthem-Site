// --- START OF FILE public/js/modules/ui.js ---

// This module is responsible for all direct DOM manipulation and rendering.

// A helper function to create elements with attributes and content
function createElement(tag, attributes = {}, content = '') {
    const el = document.createElement(tag);
    for (const key in attributes) {
        el.setAttribute(key, attributes[key]);
    }
    if (typeof content === 'string') {
        el.innerHTML = content;
    } else if (content instanceof Node) {
        el.appendChild(content);
    } else if (Array.isArray(content)) {
        content.forEach(child => el.appendChild(child));
    }
    return el;
}

export function setStatus(statusEl, message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ef4444' : '#9ca3af';
    if (message) {
        setTimeout(() => {
            if (statusEl) statusEl.textContent = '';
        }, 3000);
    }
}

export function renderChordPalette(paletteEl, chords, onChordClick) {
    if (!paletteEl) return;
    paletteEl.innerHTML = ''; 
    chords.forEach(c => { 
        const btn = createElement('button', { class: 'btn btn-secondary btn-sm' }, c.name);
        btn.onclick = (e) => onChordClick(e, c.name);
        paletteEl.appendChild(btn); 
    });
}

export function renderChordQueue(queueDiv, clearBtn, queue, currentIndex) {
    if (!queueDiv || !clearBtn) return;
    queueDiv.innerHTML = ''; 
    const lyricsBlocks = document.querySelectorAll('.lyrics-block');
    if (queue.length === 0) { 
        lyricsBlocks.forEach(el => el.classList.remove('placement-mode'));
        clearBtn.disabled = true; 
        return; 
    } 
    lyricsBlocks.forEach(el => el.classList.add('placement-mode'));
    clearBtn.disabled = false; 
    queue.forEach((name, index) => { 
        const pillClass = `queue-pill ${index === currentIndex ? 'next' : ''}`;
        const pill = createElement('span', { class: pillClass }, name);
        queueDiv.appendChild(pill); 
    });
}

export function parseLineForRender(rawLine) {
    if (!rawLine || !rawLine.trim()) return { chordLine: ' ', lyricLine: ' ' };
    let chordLine = ""; 
    let lyricLine = "";
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

export function renderPreview(previewEl, songBlocks, renderTransposedTab) {
    if (!previewEl) return;
    let previewHtml = '';
    (songBlocks || []).forEach(block => {
        let blockToRender = block.type === 'reference' ? (songBlocks.find(b => b.id === block.originalId) || block) : block;
        previewHtml += `<h4 class="text-lg font-bold mt-4 text-gray-400">${block.label}</h4>`;
        if (!blockToRender) return;
        if (blockToRender.type === 'lyrics' && blockToRender.content) {
            blockToRender.content.split('\n').forEach(line => {
                const parsed = parseLineForRender(line);
                previewHtml += `<div class="live-preview-chords">${parsed.chordLine}</div><div>${parsed.lyricLine}</div>`;
            });
        } else if (blockToRender.type === 'tab' && blockToRender.data) {
            previewHtml += `<div class="tab-preview">${renderTransposedTab(blockToRender)}</div>`;
        } else if (blockToRender.type === 'drum_tab') {
            previewHtml += `<div class="tab-preview">${blockToRender.content || ''}</div>`;
        }
    });
    previewEl.innerHTML = previewHtml;
}

export function createBlockElement(block, drawFretboardCallback) {
    const div = createElement('div', { class: 'song-block', 'data-block-id': block.id });
    let contentHtml = '', headerControls = '';
    const drumPlaceholder = `HH|x-x-x-x-x-x-x-x-|\nSD|----o-------o---|\nBD|o-------o-------|`;

    if (block.type === 'lyrics') {
        contentHtml = `<textarea class="form-textarea lyrics-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="Enter lyrics and [chords]...">${block.content || ''}</textarea><div class="resize-handle"></div>`;
    } else if (block.type === 'tab') {
        const stringOptions = [6, 7, 8].map(num => `<option value="${num}" ${block.strings === num ? 'selected' : ''}>${num}-String</option>`).join('');
        contentHtml = `<div class="mb-2"><label class="text-xs text-gray-400">Instrument:</label><select class="form-select form-input text-sm w-32 bg-gray-900" data-action="change-strings">${stringOptions}</select></div><div class="fretboard-wrapper"><div id="fretboard-${block.id}"></div></div>`;
        const isEditMode = block.editMode || false;
        const editButtonClass = isEditMode ? 'btn-edit-mode' : 'btn-secondary';
        headerControls = `<button class="btn ${editButtonClass} btn-sm" data-action="edit-tab">${isEditMode ? 'Done Editing' : 'Edit'}</button>`;
    } else if (block.type === 'drum_tab') {
        contentHtml = `<textarea class="form-textarea drum-tab-block" data-field="content" style="height: ${block.height || 100}px;" placeholder="${drumPlaceholder}">${block.content || ''}</textarea><div class="resize-handle"></div>`;
    }
    
    div.innerHTML = `
        <div class="block-header">
            <div class="flex items-center gap-2"><span class="font-bold">${block.label}</span><span class="text-xs text-gray-400">(${block.type.replace('_', ' ')})</span></div>
            <div class="flex items-center gap-2">${headerControls}<button class="btn-sm text-xs hover:underline" data-action="rename">Rename</button><button class="btn-sm text-red-400 hover:underline" data-action="delete">Delete</button></div>
        </div>
        <div class="block-content">${contentHtml}</div>`;
    
    if (block.type === 'tab' && drawFretboardCallback) {
        setTimeout(() => drawFretboardCallback(block.id), 0);
    }
    return div;
}

export function renderSongBlocks(containerEl, songBlocks, createBlockElementCallback, initializeSortableCallback) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    (songBlocks || []).forEach(block => {
        let blockToRender = block;
        if (block.type === 'reference') {
            const originalBlock = songBlocks.find(b => b.id === block.originalId);
            const refDiv = createElement('div', { class: 'song-block', 'data-block-id': block.id });
            refDiv.innerHTML = `
                <div class="block-header">
                    <div class="flex items-center gap-2"><span class="font-bold">${block.label}</span><span class="text-xs text-gray-400">(reference)</span></div>
                    <div><button class="btn-sm text-red-400 hover:underline" data-action="delete">Delete</button></div>
                </div>
                <div class="block-content"><div class="p-4 bg-gray-800 rounded-md text-gray-400 italic">Reference to: ${originalBlock ? originalBlock.label : 'Unknown Section'}</div></div>`;
            containerEl.appendChild(refDiv);
        } else {
            containerEl.appendChild(createBlockElementCallback(blockToRender));
        }
    });
    if (initializeSortableCallback) {
        initializeSortableCallback();
    }
}

export function renderAddBlockButtons(containerEl, songBlocks) {
    if (!containerEl) return;
    const createdSections = songBlocks.filter(b => b.type !== 'reference');
    let referenceButtonsHtml = '';
    if (createdSections.length > 0) {
        const refItems = createdSections.map(b => `<a href="#" class="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600" data-original-id="${b.id}" role="menuitem">${b.label}</a>`).join('');
        referenceButtonsHtml = `
            <div class="relative inline-block text-left">
                <button id="insert-ref-btn" class="btn btn-secondary">Insert Existing Section</button>
                <div id="ref-dropdown" class="hidden origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                    <div class="py-1" role="menu" aria-orientation="vertical">${refItems}</div>
                </div>
            </div>`;
    }
    containerEl.innerHTML = `
        <button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Verse </button>
        <button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Chorus </button>
        <button class="btn btn-secondary" data-action="add" data-type="lyrics"> + Bridge </button>
        <button class="btn btn-secondary" data-action="add" data-type="tab"> + Tab Section </button>
        <button class="btn btn-secondary" data-action="add" data-type="drum_tab"> + Drum Tab </button>
        ${referenceButtonsHtml}`;
}

export function populateTuningSelector(selectorEl, TUNINGS) {
    if (!selectorEl) return;
    for (const key in TUNINGS) {
        const option = createElement('option', { value: key }, TUNINGS[key].name);
        selectorEl.appendChild(option);
    }
}

export async function loadSheetList(selectorEl, api, selectId = null) {
    if (!selectorEl) return;
    try {
        const songs = await api.getSheets();
        songs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        selectorEl.innerHTML = '<option value="new">-- Create New Song --</option>';
        songs.forEach(s => {
            const o = createElement('option', { value: s.id }, s.title || 'Untitled');
            selectorEl.appendChild(o);
        });
        if (selectId) {
            selectorEl.value = selectId;
        }
    } catch (e) {
        console.error('Failed to load songs:', e);
        selectorEl.innerHTML = '<option value="new">-- Create New Song --</option>';
    }
}
