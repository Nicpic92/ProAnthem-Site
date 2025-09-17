// --- START OF FILE public/js/modules/diagramRenderer.js ---

/**
 * Renders an SVG guitar chord diagram from structured data.
 * @param {object} diagramData - The chord diagram data from the database.
 * @returns {string} An SVG element as a string.
 */
export function renderGuitarDiagram(diagramData) {
    if (!diagramData || !diagramData.frets || !diagramData.fingers) return '';

    const [startFret, endFret] = diagramData.frets;
    const numFrets = endFret - startFret + 1;
    const width = 100;
    const height = 120;
    const stringSpacing = 18;
    const fretSpacing = 22;

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: #fff; border: 1px solid #ccc; border-radius: 4px;">`;

    // Fret number indicator
    if (startFret > 1) {
        svg += `<text x="${width - 12}" y="25" font-size="12" fill="#333">${startFret}fr</text>`;
    }

    // Frets and strings
    for (let i = 0; i < 6; i++) {
        svg += `<line x1="${5 + i * stringSpacing}" y1="15" x2="${5 + i * stringSpacing}" y2="${15 + numFrets * fretSpacing}" stroke="#666" />`; // Strings
    }
    for (let i = 0; i <= numFrets; i++) {
        const y = 15 + i * fretSpacing;
        const strokeWidth = (i === 0 && startFret === 1) ? 3 : 1; // Thicker nut
        svg += `<line x1="5" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#666" stroke-width="${strokeWidth}" />`; // Frets
    }

    // Open/Muted strings
    const allFingeredStrings = diagramData.fingers.map(f => f[0]);
    for (let i = 0; i < 6; i++) {
        const x = 5 + (5 - i) * stringSpacing;
        if (!allFingeredStrings.includes(i)) {
            if (diagramData.openStrings && diagramData.openStrings.includes(i)) {
                svg += `<circle cx="${x}" cy="8" r="3" stroke="#333" fill="none" stroke-width="1" />`; // Open
            } else {
                svg += `<text x="${x - 4}" y="12" font-size="12" fill="#999">x</text>`; // Muted
            }
        }
    }

    // Fingers
    diagramData.fingers.forEach(([string, fret, finger]) => {
        const actualFret = fret - startFret + 1;
        const x = 5 + (5 - string) * stringSpacing;
        const y = 15 + actualFret * fretSpacing - (fretSpacing / 2);
        svg += `<circle cx="${x}" cy="${y}" r="7" fill="#333" />`;
        if (finger) {
            svg += `<text x="${x}" y="${y + 4}" font-size="10" fill="#fff" text-anchor="middle">${finger}</text>`;
        }
    });

    svg += '</svg>';
    return svg;
}
// --- END OF FILE public/js/modules/diagramRenderer.js ---
