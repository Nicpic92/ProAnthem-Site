// --- START OF FILE public/js/app.js ---

import * as api from './api.js';
import { checkAccess, getUserPayload } from './auth.js';
// We will create these modules in the next steps
// import * as UI from './modules/ui.js';
// import * as Setlist from './modules/setlist.js';
// import * as Fretboard from './modules/fretboard.js';

const isDemoMode = window.location.pathname.includes('Demo.html');

document.addEventListener('DOMContentLoaded', () => {
    if (isDemoMode) {
        initializeAppForDemo();
    } else {
        if (checkAccess()) {
            const user = getUserPayload();
            if (user && user.force_reset) {
                document.getElementById('password-reset-modal').classList.remove('hidden');
                document.getElementById('password-reset-form').addEventListener('submit', handlePasswordReset);
            } else {
                initializeAppForLiveApp();
            }
        }
    }
});

function initializeAppForDemo() {
    console.log("Initializing in DEMO mode.");
    // For now, we'll keep the logic here. In the future, this will call modules.
    // const coreApp = new ProAnthemApp(true);
    // coreApp.init();
    alert("Demo Mode Initialized (placeholder)");
}

function initializeAppForLiveApp() {
    console.log("Initializing in LIVE APP mode.");
    // For now, we'll keep the logic here. In the future, this will call modules.
    // const coreApp = new ProAnthemApp(false);
    // coreApp.init();
    alert("Live App Initialized (placeholder)");
}

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
        await api.changePassword({ currentPassword, newPassword });
        alert('Password updated successfully! You can now use the tool.');
        document.getElementById('password-reset-modal').classList.add('hidden');
        initializeAppForLiveApp();
    } catch (error) {
        errorEl.textContent = error.message;
    }
}

// All the giant ProAnthemApp class and its methods will be moved to the module files.
// For now, this file is just the entry point.

// --- END OF FILE public/js/app.js ---
