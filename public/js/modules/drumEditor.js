// --- START OF FILE public/js/modules/drumEditor.js ---

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

/**
 * Parses a standard drum tab string into a structured array of objects.
 * @param {string} tabString - The raw drum tab string (e.g., "HH|x-x-|\nSD|--o-|").
 * @returns {Array<Object>} An array like [{ instrument: 'HH', pattern: 'x-x-' }, ...].
 */
function parseTabString(tabString) {
    if (!tabString || typeof tabString !== 'string') return [];
    const lines = tabString.split('\n').filter(line => line.includes('|'));
    return lines.map(line => {
        const parts = line.match(/^(.+?)\|(.+)\|$/);
        if (parts && parts.length === 3) {
            return { instrument: parts[1].trim(), pattern: parts[2] };
        }
        return null;
    }).filter(Boolean); // Filter out any lines that didn't parse correctly
}

/**
 * Serializes the state of the interactive table back into a raw string for saving.
 * @param {HTMLTableElement} tableElement - The table element representing the drum editor.
 * @returns {string} The raw drum tab string.
 */
function serializeTableToString(tableElement) {
    const rows = tableElement.querySelectorAll('tr');
    const lines = [];
    rows.forEach(row => {
        const instrumentCell = row.querySelector('.drum-instrument');
        const patternCells = row.querySelectorAll('.drum-cell');
        if (instrumentCell && patternCells.length > 0) {
            const instrument = instrumentCell.textContent;
            const pattern = Array.from(patternCells).map(cell => cell.textContent).join('');
            lines.push(`${instrument.padEnd(2)}|${pattern}|`);
        }
    });
    return lines.join('\n');
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

    // Determine the number of columns from the longest pattern
    const numCols = data.reduce((max, row) => Math.max(max, row.pattern.length), 16);

    data.forEach(rowData => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.className = 'drum-instrument';
        th.textContent = rowData.instrument;
        tr.appendChild(th);

        for (let i = 0; i < numCols; i++) {
            const td = document.createElement('td');
            const char = rowData.pattern[i] || '-';
            td.textContent = char;
            td.className = 'drum-cell';
            td.title = DRUM_NOTATION[char] || 'Unknown';
            td.dataset.colIndex = i;
            tr.appendChild(td);
        }
        table.appendChild(tr);
    });

    // Event Delegation: Handle clicks on the table level for efficiency
    table.addEventListener('click', (e) => {
        if (e.target.classList.contains('drum-cell')) {
            const currentVal = e.target.textContent;
            const currentIndex = CLICK_CYCLE.indexOf(currentVal);
            const nextIndex = (currentIndex + 1) % CLICK_CYCLE.length;
            const newVal = CLICK_CYCLE[nextIndex];
            
            e.target.textContent = newVal;
            e.target.title = DRUM_NOTATION[newVal] || 'Unknown';

            // After changing the UI, serialize the whole table and call the callback
            const newString = serializeTableToString(table);
            onChange(newString);
        }
    });
    
    container.appendChild(table);
}
