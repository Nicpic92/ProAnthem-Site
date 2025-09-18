// --- START OF FILE public/js/main.js ---

import { checkAccess, getUserPayload } from '/js/auth.js';
import * as songEditor from './modules/songEditor.js';
import * as setlistManager from './modules/setlistManager.js';
import * as historyManager from './modules/historyManager.js';
import { checkForcedReset } from './passwordResetHandler.js';

// This is the new main entry point for the entire application.
// Its only job is to check for access and initialize the correct modules.

document.addEventListener('DOMContentLoaded', () => {
    // 1. First, check if the user has access to this page at all.
    // The checkAccess function will also reveal the main content area.
    const hasAccess = checkAccess();
    if (!hasAccess) {
        // If checkAccess fails, it handles the redirect, so we stop execution here.
        return; 
    }

    const path = window.location.pathname.toLowerCase();
    const isDemoMode = path.endsWith('/demo') || path.endsWith('/demo.html');
    
    // 2. Initialize the core modules of the application.
    // We pass the isDemoMode flag so modules can adapt their behavior (e.g., disable saving).
    songEditor.init(isDemoMode);
    setlistManager.init(isDemoMode);
    historyManager.init(isDemoMode, songEditor.reloadSong);

    // 3. Handle the special case where a new user must reset their temporary password.
    // This is now delegated to a dedicated module.
    if (!isDemoMode) {
        const user = getUserPayload();
        checkForcedReset(user);
    }
});
