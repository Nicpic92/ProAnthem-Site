// --- START OF FILE public/js/modules/stagePlotIcons.js ---

// This library stores SVG paths and properties for stage plot items.
// Using a central library makes it easy to add or change icons later.

export const ICONS = {
    'mic': {
        // Simple circle with three lines for a vocal mic
        svg: `<circle cx="15" cy="15" r="12" stroke-width="2" stroke="#fff" fill="none" />
              <line x1="15" y1="3" x2="15" y2="8" stroke-width="2" stroke="#fff" />
              <line x1="8" y1="6" x2="11" y2="9" stroke-width="2" stroke="#fff" />
              <line x1="22" y1="6" x2="19" y2="9" stroke-width="2" stroke="#fff" />`,
        viewBox: '0 0 30 30'
    },
    'amp': {
        // Rectangle with a small circle for a speaker cone
        svg: `<rect x="2" y="2" width="26" height="26" rx="2" stroke-width="2" stroke="#fff" fill="none" />
              <circle cx="15" cy="15" r="7" stroke-width="2" stroke="#fff" fill="none" />`,
        viewBox: '0 0 30 30'
    },
    'bass-amp': {
        // Similar to amp, but with a small 'B'
        svg: `<rect x="2" y="2" width="26" height="26" rx="2" stroke-width="2" stroke="#fff" fill="none" />
              <circle cx="15" cy="15" r="7" stroke-width="2" stroke="#fff" fill="none" />
              <text x="15" y="18" font-size="8" fill="#fff" text-anchor="middle">B</text>`,
        viewBox: '0 0 30 30'
    },
    'monitor': {
        // A wedge shape
        svg: `<polygon points="2,25 28,25 20,5" stroke-width="2" stroke="#fff" fill="none" />`,
        viewBox: '0 0 30 30'
    },
    'drums': {
        // A collection of circles representing a simple drum kit layout
        svg: `<circle cx="15" cy="15" r="6" stroke-width="2" stroke="#fff" fill="none" />
              <circle cx="25" cy="10" r="4" stroke-width="2" stroke="#fff" fill="none" />
              <circle cx="5" cy="10" r="4" stroke-width="2" stroke="#fff" fill="none" />
              <circle cx="15" cy="25" r="5" stroke-width="2" stroke="#fff" fill="none" />`,
        viewBox: '0 0 30 30'
    },
    'keyboard': {
        // A rectangle with lines representing black keys
        svg: `<rect x="2" y="8" width="26" height="14" rx="1" stroke-width="2" stroke="#fff" fill="none" />
              <rect x="6" y="8" width="2" height="8" fill="#fff" />
              <rect x="10" y="8" width="2" height="8" fill="#fff" />
              <rect x="18" y="8" width="2" height="8" fill="#fff" />
              <rect x="22" y="8" width="2" height="8" fill="#fff" />`,
        viewBox: '0 0 30 30'
    },
    'di': {
        // A simple box with 'DI' text
        svg: `<rect x="5" y="8" width="20" height="14" rx="1" stroke-width="2" stroke="#fff" fill="none" />
              <text x="15" y="19" font-size="8" fill="#fff" text-anchor="middle">DI</text>`,
        viewBox: '0 0 30 30'
    },
    'custom': {
        // A dashed box for custom items
        svg: `<rect x="2" y="2" width="26" height="26" rx="2" stroke-width="2" stroke="#fff" fill="none" stroke-dasharray="4" />`,
        viewBox: '0 0 30 30'
    }
};
// --- END OF FILE public/js/modules/stagePlotIcons.js ---
