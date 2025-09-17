// --- START OF FILE public/js/modules/importParser.js ---

/**
 * Parses a block of pasted text (likely from a guitar tab website) into a structured
 * array of song blocks and attempts to extract metadata like capo and tuning.
 * @param {string} text - The raw pasted text.
 * @returns {{blocks: Array<object>, metadata: {capo: number, tuning: string}}}
 */
export function parsePastedSong(text) {
    let metadata = { capo: 0, tuning: 'E_STANDARD' };
    
    // 1. Pre-process and filter lines
    let lines = text.split('\n').map(l => l.replace(/\r/g, ''));
    lines = lines.filter(line => {
        const capoMatch = line.match(/capo\s*:?\s*(\d+)/i);
        if (capoMatch) {
            metadata.capo = parseInt(capoMatch[1], 10);
            return false; // Remove this line from the content
        }
        if (line.match(/tuning/i)) {
            const l = line.toLowerCase();
            if (l.includes('eb') || l.includes('e flat')) metadata.tuning = 'EB_STANDARD';
            else if (l.includes('drop d')) metadata.tuning = 'DROP_D';
            else if (l.includes('d standard')) metadata.tuning = 'D_STANDARD';
            else if (l.includes('drop c')) metadata.tuning = 'DROP_C';
            return false; // Remove this line from the content
        }
        // Filter out common website junk
        return !line.match(/^Page \d+\/\d+$/i) && !line.match(/ultimate-guitar\.com/i);
    });

    const newBlocks = [];
    let currentBlock = null;

    // 2. Define Regular Expressions for parsing
    const headerRegex = /^\s*(?:\[([^\]]+)\]|(intro|verse|chorus|bridge|pre-chorus|prechorus|solo|outro|tag|instrumental)[\s\d:]*)\s*$/i;
    const tabLineRegex = /\|.*-|-.*\|/;
    const chordRegexSource = `[A-G][b#]?(?:m|maj|sus|dim|add|aug|m7|7|maj7|m7b5|6|9|11|13)*(?:\\/[A-G][b#]?)?`;
    const chordLineRegex = new RegExp(`^\\s*(${chordRegexSource}(\\s+${chordRegexSource})*\\s*)$`);

    // 3. Helper functions for building blocks
    const pushBlock = () => {
        if (currentBlock) {
            currentBlock.content = currentBlock.content.trim();
            if (currentBlock.content) newBlocks.push(currentBlock);
        }
    };

    const createNewBlock = (label, type) => {
        pushBlock();
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase().replace('prechorus', 'Pre-Chorus');
        currentBlock = {
            id: `block_${Date.now()}_${newBlocks.length}`,
            label: capitalizedLabel || 'Section',
            type: type,
            content: '',
            height: 120
        };
    };

    // 4. Helper functions for processing lines
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

    // 5. Main processing loop
    let sectionLines = [];
    const processSectionLines = (blockLines) => {
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
                i++; // Skip the next line as it has been merged
            } else {
                processedLines.push(bracketInlineChords(currentLine));
            }
        }
        currentBlock.content += processedLines.join('\n') + '\n\n';
    };

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
    
    pushBlock(); // Push the last processed block

    return { blocks: newBlocks, metadata: metadata };
}
