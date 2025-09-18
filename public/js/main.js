// --- START OF FILE public/js/main.js ---

import { checkAccess, getUserPayload } from '/js/auth.js';
import * as songEditor from './modules/songEditor.js';
import * as setlistManager from './modules/setlistManager.js';
import * as historyManager from './modules/historyManager.js';
import { checkForcedReset } from './passwordResetHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    const hasAccess = checkAccess();
    if (!hasAccess) {
        return; 
    }

    const path = window.location.pathname.toLowerCase();
    const isDemoMode = path.endsWith('/demo') || path.endsWith('/demo.html');
    
    songEditor.init(isDemoMode);
    setlistManager.init(isDemoMode);
    historyManager.init(isDemoMode, songEditor.reloadSong);

    if (!isDemoMode) {
        const user = getUserPayload();
        checkForcedReset(user);
    }
});
