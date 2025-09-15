// --- START OF FILE public/js/modules/fretboard.js ---

// This module contains all logic for the interactive fretboard and tab rendering.

export function drawFretboard(blockId, numStrings, TUNINGS, STRING_CONFIG, FRETBOARD_CONFIG, drawNotesCallback, attachListenersCallback) {
    const container = document.getElementById(`fretboard-${blockId}`);
    if (!container) return;
    
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
    drawNotesCallback(blockId);
    const svgEl = document.getElementById(`fretboard-svg-${blockId}`);
    if (svgEl) {
        attachListenersCallback(svgEl);
    }
}

export function drawNotesOnFretboard(blockId, notes, selectedNote, numStrings, tuning, capo, TUNINGS, STRING_CONFIG, FRETBOARD_CONFIG) {
    const notesGroup = document.getElementById(`fretboard-notes-group-${blockId}`);
    if (!notesGroup) return;
    
    notesGroup.innerHTML = '';
    const stringConfig = STRING_CONFIG[numStrings];
    const totalOffset = (TUNINGS[tuning]?.offset ?? 0) + capo;

    (notes || []).forEach((note, index) => {
        if (note.string >= numStrings) return;
        const transposedFret = note.fret - totalOffset;
        if (transposedFret < 0) return;

        const y = stringConfig.stringSpacing / 2 + note.string * stringConfig.stringSpacing;
        const x = note.position;
        const isSelected = selectedNote.blockId === blockId && selectedNote.noteIndex === index;
        
        const noteGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        noteGroup.classList.add('note-group');
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute('class', `fretboard-note ${isSelected ? 'selected' : ''}`);
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', FRETBOARD_CONFIG.noteRadius);
        circle.setAttribute('data-note-index', index);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('class', 'fretboard-note-text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.textContent = transposedFret;

        noteGroup.appendChild(circle);
        noteGroup.appendChild(text);
        notesGroup.appendChild(noteGroup);
    });
}

export function getFretFromClick(evt, svgEl, numStrings, STRING_CONFIG, FRETBOARD_CONFIG) {
    const wrapper = svgEl.closest('.fretboard-wrapper');
    if (!wrapper) return null;
    
    const svgRect = svgEl.getBoundingClientRect();
    const x = evt.clientX - svgRect.left + wrapper.scrollLeft;
    const y = evt.clientY - svgRect.top;
    
    const stringConfig = STRING_CONFIG[numStrings];
    const stringIndex = Math.floor(y / stringConfig.stringSpacing);
    const rawFret = (x - FRETBOARD_CONFIG.nutWidth) / FRETBOARD_CONFIG.fretSpacing;
    const fret = Math.max(0, Math.round(rawFret));

    if (stringIndex >= 0 && stringIndex < numStrings && fret <= FRETBOARD_CONFIG.frets) {
        return { string: stringIndex, fret, position: x };
    }
    return null;
}

export function renderTransposedTab(tabBlock, tuning, capo, transpose, TUNINGS, FRETBOARD_CONFIG) {
    if (!tabBlock.data || !tabBlock.data.notes || tabBlock.data.notes.length === 0) return 'No tab data.';
    
    const numStrings = tabBlock.strings || 6;
    const tuningInfo = TUNINGS[tuning];
    const stringNames = tuningInfo?.strings?.slice(0, numStrings) || Array(numStrings).fill('?');
    const totalOffset = (tuningInfo?.offset ?? 0) + capo + transpose;

    const positionMap = new Map();
    const sortedNotes = [...tabBlock.data.notes].sort((a,b) => a.position - b.position);

    sortedNotes.forEach(note => {
        if (note.string >= numStrings) return;
        const transposedFret = note.fret - totalOffset;
        if (transposedFret < 0) return;

        const charPosition = Math.floor((note.position - FRETBOARD_CONFIG.nutWidth) / 10);
        if (charPosition < 0) return;
        if (!positionMap.has(charPosition)) {
            positionMap.set(charPosition, Array(numStrings).fill(null));
        }
        positionMap.get(charPosition)[note.string] = transposedFret;
    });

    if (positionMap.size === 0) return 'Notes out of range for current settings.';
    
    const sortedPositions = [...positionMap.keys()].sort((a,b) => a - b);
    const lines = stringNames.map(name => `${name.padEnd(2, ' ')}|`);
    let lastCharPos = 0;
    
    sortedPositions.forEach(charPos => {
        const notesAtPos = positionMap.get(charPos);
        const padding = charPos - lastCharPos;
        if (padding > 1) {
            lines.forEach((_, i) => lines[i] += '-'.repeat(padding - 1));
        }
        let maxFretWidth = 1;
        notesAtPos.forEach(fret => {
            if (fret !== null) maxFretWidth = Math.max(maxFretWidth, String(fret).length)
        });
        lines.forEach((_, i) => {
            lines[i] += (notesAtPos[i] !== null) ? String(notesAtPos[i]).padEnd(maxFretWidth, '-') : '-'.repeat(maxFretWidth)
        });
        lastCharPos = charPos + maxFretWidth - 1;
    });
    
    return lines.join('\n');
}


// --- END OF FILE public/js/modules/fretboard.js ---
