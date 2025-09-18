// --- In public/js/auth.js ---
export function checkAccess() {
    const protectedPages = [
        '/dashboard.html',
        '/projectanthem.html',
        '/band.html',
        '/admin.html',
        '/stage-plot-editor.html',
        '/show.html'
    ];
    const currentPath = window.location.pathname.toLowerCase();
    const isProtected = protectedPages.some(page => currentPath.endsWith(page));

    if (!isProtected) {
        return true;
    }

    const user = getUserPayload();
    if (!user) {
        window.location.href = '/proanthem_index.html';
        return false;
    }

    const validStatuses = ['active', 'trialing', 'admin_granted', 'free'];
    if (user.role === 'admin' || validStatuses.includes(user.subscription_status)) {
        // --- THIS IS THE FIX ---
        // Find the single main content area on the page and show it.
        const content = document.querySelector('.main-content-area');
        if (content) {
            content.style.display = 'block'; // Handles style="display: none;"
            content.classList.remove('hidden'); // Handles the 'hidden' class
        }
        return true;
    } else {
        window.location.href = '/pricing.html';
        return false;
    }
}
