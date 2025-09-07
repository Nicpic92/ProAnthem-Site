// At the top of the auth_proanthem.js, add this function
function checkAccess() {
    const user = getUserPayload();
    
    // Valid statuses are 'active' or 'trialing'. Admins get a free pass.
    const hasAccess = user && (user.role === 'admin' || user.subscription_status === 'active' || user.subscription_status === 'trialing');

    if (!hasAccess) {
        // Hide tool, show access denied message
        const toolContent = document.getElementById('tool-content');
        const accessDenied = document.getElementById('access-denied');
        if (toolContent) toolContent.style.display = 'none';
        if (accessDenied) accessDenied.style.display = 'block';

        // Update the access denied message with a link to manage their subscription.
        const accessDeniedLink = accessDenied.querySelector('a');
        if (accessDeniedLink) {
             accessDeniedLink.textContent = 'Manage Subscription';
             accessDeniedLink.href = '/pricing.html';
        }
    } else {
        // User has access, initialize the application.
        const toolContent = document.getElementById('tool-content');
        if(toolContent && typeof initializeApp === 'function') {
            toolContent.classList.remove('hidden');
            initializeApp();
        }
    }
}
// Also modify the login logic to handle subscription status correctly.
async function performLogin(credentials) {
    const result = await apiRequest('login', credentials, 'POST');
    if (result.token) {
        localStorage.setItem('user_token', result.token);
        const user = getUserPayload(); // Re-decode the new token
        
        const hasAccess = user && (user.role === 'admin' || user.subscription_status === 'active' || user.subscription_status === 'trialing');

        if (hasAccess) {
            window.location.href = '/ProjectAnthem.html';
        } else {
            // User logged in but has no active sub, send them to pricing.
            window.location.href = '/pricing.html';
        }
    } else {
        throw new Error("Login failed: No token returned.");
    }
}
