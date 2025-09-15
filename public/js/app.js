// --- START OF FILE public/js/app.js ---

import { checkAccess, getUserPayload } from './auth.js';
import * as api from './api.js';

const isDemoMode = window.location.pathname.includes('Demo.html');

document.addEventListener('DOMContentLoaded', () => {
    if (isDemoMode) {
        initializeAppForDemo();
    } else {
        // Now that checkAccess is imported, this will work correctly.
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
    // This will be expanded later, but for now, it confirms the script runs.
    alert("Demo Mode Initialized (placeholder)");
}

function initializeAppForLiveApp() {
    console.log("Initializing in LIVE APP mode.");
    // This will be expanded later.
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
        // Use the imported api module
        await api.changePassword({ currentPassword, newPassword });
        alert('Password updated successfully! You can now use the tool.');
        document.getElementById('password-reset-modal').classList.add('hidden');
        initializeAppForLiveApp();
    } catch (error) {
        errorEl.textContent = error.message;
    }
}


// All the complex application logic (the ProAnthemApp class) has been temporarily removed
// to ensure we can fix this core initialization error first. Once this works, we will add it back.

// --- END OF FILE public/js/app.js ---
