// --- START OF FILE public/js/app.js ---

import { checkAccess, getUserPayload } from './auth.js';
import * as songEditor from './modules/songEditor.js';
import * as setlistManager from './modules/setlistManager.js';
// --- THIS IS THE FIX ---
// The import path was missing the folder structure.
import * as historyManager from './modules/historyManager.js';

// This is the main entry point for the entire application.
// Its only job is to check for access and initialize the correct modules.

document.addEventListener('DOMContentLoaded', () => {
    // 1. First, check if the user has access to this page at all.
    const hasAccess = checkAccess();
    if (!hasAccess) {
        return; 
    }

    const path = window.location.pathname.toLowerCase();
    const isDemoMode = path.endsWith('/demo') || path.endsWith('/demo.html');
    
    // 2. Initialize the core modules of the application.
    // We pass the isDemoMode flag so modules can adapt their behavior (e.g., disable saving).
    songEditor.init(isDemoMode);
    setlistManager.init(isDemoMode);
    historyManager.init(isDemoMode);

    // 3. Handle the special case where a new user must reset their temporary password.
    // This logic stays here as it's a high-level application state.
    if (!isDemoMode) {
        const user = getUserPayload();
        if (user && user.force_reset) {
            const passwordModal = document.getElementById('password-reset-modal');
            const passwordForm = document.getElementById('password-reset-form');
            if (passwordModal && passwordForm) {
                passwordModal.classList.remove('hidden');
                passwordForm.addEventListener('submit', handlePasswordReset);
            }
        }
    }
});

async function handlePasswordReset(event) {
    event.preventDefault();
    const errorEl = document.getElementById('password-reset-error');
    const currentPasswordEl = document.getElementById('current-password');
    const newPasswordEl = document.getElementById('new-password');
    const confirmPasswordEl = document.getElementById('confirm-password');

    errorEl.textContent = '';
    const currentPassword = currentPasswordEl.value;
    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'New passwords do not match.';
        return;
    }

    try {
        // We need to import the api module just for this function.
        const api = await import('./api.js');
        await api.changePassword({ currentPassword, newPassword });
        
        alert('Password updated successfully! You can now use the tool.');
        document.getElementById('password-reset-modal').classList.add('hidden');
        // No need to re-initialize; the page will effectively be un-blocked.
    } catch (error) {
        errorEl.textContent = error.message;
    }
}
