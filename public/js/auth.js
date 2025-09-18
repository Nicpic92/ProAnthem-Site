// --- START OF FILE public/js/auth.js ---

// ... (other functions remain the same) ...

export function checkAccess() {
    const publicPages = ['/', '/proanthem_index.html', '/proanthem_index', '/pricing.html', '/pricing', '/demo.html', '/demo', '/construction.html', '/construction'];
    const currentPath = window.location.pathname.toLowerCase();
    
    if (publicPages.includes(currentPath) || currentPath.startsWith('/bands/')) {
        return true;
    }

    const user = getUserPayload();
    if (!user) {
        window.location.href = '/proanthem_index.html';
        return false;
    }

    // --- THIS IS THE CHANGE ---
    // 'free' is now a valid status to access certain pages.
    const validStatuses = ['active', 'trialing', 'admin_granted', 'free'];
    if (!validStatuses.includes(user.subscription_status) && user.role !== 'admin') {
        // If status is invalid (e.g., 'canceled', 'past_due'), redirect to pricing.
        window.location.href = '/pricing.html';
        return false;
    }
    
    // Un-hide the main content of the authenticated page
    const content = document.querySelector('#tool-content, #band-content, #admin-content, #dashboard-content, #editor-content');
    if (content) {
        content.style.display = 'block';
        content.classList.remove('hidden');
    }
    
    return true;
}

// ... (other functions remain the same) ...
