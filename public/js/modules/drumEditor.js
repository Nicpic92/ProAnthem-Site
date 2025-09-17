// --- START OF FILE public/js/modules/drumEditor.js ---

// A more comprehensive default instrument set. Exported for use in other modules.
export const DEFAULT_INSTRUMENTS = [
    { fullName: 'Crash Cymbal', shortName: 'CC' },
    { fullName: 'Hi-Hat', shortName: 'HH' },
    { fullName: 'Ride Cymbal', shortName: 'RC' },
    { fullName: 'Snare Drum', shortName: 'SD' },
    { fullName: 'High Tom', shortName: 'HT' },
    { fullName: 'Low Tom', shortName: 'LT' },
    { fullName: 'Floor Tom', shortName: 'FT' },
    { fullName: 'Bass Drum', shortName: 'BD' },
];

// A map of standard drum notation characters to their descriptions for tooltips.
const DRUM_NOTATION = {
    '-': 'Empty beat',
    'x': 'Hi-Hat / Cymbal (stroke)',
    'X': 'Hi-Hat / Cymbal (accent)',
    'o': 'Snare (stroke)',
    'O': 'Snare (accent)',
    '#': 'Cymbal (choke)',
    'g': 'Ghost note',
    'd': 'Drag',
    'b': 'Bass Drum',
};

// The sequence of characters to cycle through when a cell is clicked.
const CLICK_CYCLE = ['-', 'x', 'o', 'b', 'X', 'O', '#'];

// Create a lookup map for parsing short names back to full names.
const shortNameToFullNameMap = new Map(DEFAULT_INSTRUMENTS.map(i => [i.shortName, i.fullName]));

/**
 * Parses a standard drum tab string into a structured array of objects.
 * @param {string} tabString - The raw drum tab string (e.g., "HH|x-x-|\nSD|--o-|").
 * @returns {Array<Object>} An array like [{ instrument: 'Hi-Hat', shortName: 'HH', pattern: 'x-x-' }, ...].
 */
function parseTabString(tabString) {
    if (!tabString || typeof tabString !== 'string') return [];
    const lines = tabString.split('\n').filter(line => line.includes('|'));
    return lines.map(line => {
        const parts = line.match(/^(.+?)\|(.+)\|$/);
        if (parts && parts.length === 3) {
            const shortName = parts[1].trim();
            return {
                instrument: shortNameToFullNameMap.get(shortName) || shortName, // Fallback to shortName if not in map
                shortName: shortName,
                pattern: parts[2]
            };
        }
        return null;
    }).filter(Boolean);
}

/**
 * Serializes the state of the interactive table back into a raw string for saving.
 * @param {HTMLTableElement} tableElement - The table element representing the drum editor.
 * @returns {string} The raw drum tab string.
 */
function serializeTableToString(tableElement) {
    const rows = tableElement.querySelectorAll('tr');
    const lines = [];
    let maxShortNameLength = 0;
    // First pass to find the longest short name for padding
    rows.forEach(row => {
        const shortName = row.dataset.shortName || '';
        if (shortName.length > maxShortNameLength) {
            maxShortNameLength = shortName.length;
        }
    });

    rows.forEach(row => {
        const shortName = row.dataset.shortName || '';
        const patternCells = row.querySelectorAll('.drum-cell');
        if (shortName && patternCells.length > 0) {
            const pattern = Array.from(patternCells).map(cell => cell.textContent).join('');
            lines.push(`${shortName.padEnd(maxShortNameLength)}|${pattern}|`);
        }
    });
    return lines.join('\n');
}

/**
 * Dynamically adds a new instrument row to the editor table.
 * @param {HTMLTableElement} table - The table to add the row to.
 * @param {object} instrument - The instrument object { fullName, shortName }.
 * @param {number} numCols - The number of pattern cells to create.
 */
function addInstrumentRow(table, instrument, numCols) {
    const tr = document.createElement('tr');
    tr.dataset.shortName = instrument.shortName;

    const th = document.createElement('th');
    th.className = 'drum-instrument';
    th.innerHTML = `
        <span class="drum-instrument-name">${instrument.fullName}</span>
        <div class="drum-instrument-controls">
            <button class="drum-remove-btn" title="Remove Instrument">&times;</button>
        </div>
    `;
    tr.appendChild(th);

    for (let i = 0; i < numCols; i++) {
        const td = document.createElement('td');
        td.textContent = '-';
        td.className = 'drum-cell';
        td.title = DRUM_NOTATION['-'];
        tr.appendChild(td);
    }
    table.querySelector('tbody').appendChild(tr);
}


/**
 * Creates and initializes the interactive drum editor within a given container.
 * @param {HTMLElement} container - The container element to build the editor in.
 * @param {string} initialContent - The initial drum tab string to render.
 * @param {function(string):void} onChange - A callback function to execute with the new string when the tab is modified.
 */
export function createEditor(container, initialContent, onChange) {
    const data = parseTabString(initialContent);
    container.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    table.className = 'drum-editor-table';
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const numCols = data.reduce((max, row) => Math.max(max, row.pattern.length), 16);

    data.forEach(rowData => {
        const tr = document.createElement('tr');
        tr.dataset.shortName = rowData.shortName;
        
        const th = document.createElement('th');
        th.className = 'drum-instrument';
        th.innerHTML = `
            <span class="drum-instrument-name">${rowData.instrument}</span>
            <div class="drum-instrument-controls">
                <button class="drum-remove-btn" title="Remove Instrument">&times;</button>
            </div>
        `;
        tr.appendChild(th);

        for (let i = 0; i < numCols; i++) {
            const td = document.createElement('td');
            const char = rowData.pattern[i] || '-';
            td.textContent = char;
            td.className = 'drum-cell';
            td.title = DRUM_NOTATION[char] || 'Unknown';
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });

    // --- UI for adding a new instrument ---
    const addInstrumentDiv = document.createElement('div');
    addInstrumentDiv.className = 'drum-add-form';
    addInstrumentDiv.innerHTML = `
        <input type="text" placeholder="Full Name (e.g. Cowbell)" class="form-input form-input-sm drum-add-input">
        <input type="text" placeholder="Code (e.g. CB)" class="form-input form-input-sm drum-add-input">
        <button class="btn btn-secondary btn-sm">Add</button>
    `;

    // Event Delegation for the entire editor
    container.addEventListener('click', (e) => {
        const target = e.target;

        // Handle clicking on a pattern cell
        if (target.classList.contains('drum-cell')) {
            const currentVal = target.textContent;
            const currentIndex = CLICK_CYCLE.indexOf(currentVal);
            const nextIndex = (currentIndex + 1) % CLICK_CYCLE.length;
            const newVal = CLICK_CYCLE[nextIndex];
            
            target.textContent = newVal;
            target.title = DRUM_NOTATION[newVal] || 'Unknown';
            onChange(serializeTableToString(table));
        }

        // Handle removing an instrument
        if (target.classList.contains('drum-remove-btn')) {
            target.closest('tr').remove();
            onChange(serializeTableToString(table));
        }
        
        // Handle clicking the "Add" button for a new instrument
        if (target.tagName === 'BUTTON' && target.closest('.drum-add-form')) {
            const form = target.closest('.drum-add-form');
            const fullNameInput = form.querySelector('input[placeholder="Full Name (e.g. Cowbell)"]');
            const shortNameInput = form.querySelector('input[placeholder="Code (e.g. CB)"]');
            
            const fullName = fullNameInput.value.trim();
            const shortName = shortNameInput.value.trim();

            if (fullName && shortName) {
                const currentCols = table.querySelector('tr')?.querySelectorAll('.drum-cell').length || 16;
                addInstrumentRow(table, { fullName, shortName }, currentCols);
                fullNameInput.value = '';
                shortNameInput.value = '';
                onChange(serializeTableToString(table));
            } else {
                alert('Please provide both a full name and a short code for the new instrument.');
            }
        }
    });
    
    container.appendChild(table);
    container.appendChild(addInstrumentDiv);
}
