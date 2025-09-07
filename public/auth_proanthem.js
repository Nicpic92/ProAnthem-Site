// This is the unified authentication script for the entire ProAnthem site.

document.addEventListener('DOMContentLoaded', () => {
    updateNav(); // Runs on every page load to set up the correct navigation

    // These listeners are only attached if the respective forms exist on the current page
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Logic specifically for the pricing page signup form
    const signupFormPricing = document.querySelector("#signup-view form");
    if(signupFormPricing) signupFormPricing.addEventListener('submit', handleSignupForPricing);
});

// --- Core Auth & API Functions ---

function getToken() {
    return localStorage.getItem('user_token');
}

function getUserPayload() {
    const token = getToken();
    if (!token) return null;
    try {
        // atob is a deprecated but widely supported method for base64 decoding
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user || null;
    } catch (e) {
        console.error('Failed to parse token:', e);
        logout(); // Log out if token is malformed
        return null;
    }
}

function logout() {
    localStorage.removeItem('user_token');
    // For good measure, remove any legacy role item
    localStorage.removeItem('userRole'); 
    window.location.href = '/proanthem_index.html';
}

function updateNav() {
    const user = getUserPayload();
    // This robust selector finds the authentication div on both the main page and the admin page
    const navAuthSection = document.querySelector("#nav-auth-section");
    if (!navAuthSection) return;

    if (user) {
        // Logged-in user view for any page
        let buttonHtml = `<a href="/ProjectAnthem.html" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Tool</a>`;
        if (user.role === 'admin') {
             buttonHtml = `<a href="/admin.html" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 mr-4">Admin Panel</a>` + buttonHtml;
        }
         buttonHtml += `<button onclick="logout()" class="ml-4 text-gray-300 hover:text-white">Log Out</button>`;
        navAuthSection.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
    } else {
        // Logged-out user view for any page
        navAuthSection.innerHTML = `<button id="login-modal-button" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Log In</button>`;
        // After creating the button, immediately attach its listener
        const loginBtn = document.getElementById('login-modal-button');
        if(loginBtn) {
            loginBtn.addEventListener('click', () => openModal('login'));
        }
    }
    
    // This logic runs specifically on ProjectAnthem.html to show/hide the band management button
    const manageBandBtn = document.getElementById('manageBandBtn');
    if (manageBandBtn && user && (user.role === 'band_admin' || user.role === 'admin')) {
        manageBandBtn.style.display = 'block';
    }
}


async function apiRequest(endpoint, data = null, method = 'GET') {
    const token = getToken();
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (data) {
        options.body = JSON.stringify(data);
    }
    try {
        const response = await fetch(`/api/${endpoint}`, options);
        if (response.status === 204) return null; // Handle successful empty responses (like DELETE)
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.message || `API Error: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error);
        throw error;
    }
}

// --- Subscription & Access Control (used by ProjectAnthem.html and band.html) ---

function checkAccess() {
    const user = getUserPayload();
    // Valid statuses are 'active', 'trialing', or our special 'admin_granted' status
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    const hasAccess = user && (user.role === 'admin' || validStatuses.includes(user.subscription_status));
    
    const toolContent = document.getElementById('tool-content') || document.getElementById('band-content');
    const accessDenied = document.getElementById('access-denied');

    if (!toolContent || !accessDenied) return true; // Not on a protected page, so don't block.

    if (hasAccess) {
        accessDenied.style.display = 'none';
        toolContent.style.display = 'block'; // Make sure it's block, not just removing 'hidden'
        return true;
    } else {
        toolContent.style.display = 'none';
        accessDenied.style.display = 'block';
        const accessDeniedLink = accessDenied.querySelector('a');
        if (accessDeniedLink) {
            accessDeniedLink.textContent = user ? 'Manage Subscription' : 'Log In or Sign Up';
            accessDeniedLink.href = user ? '/pricing.html' : '/proanthem_index.html';
        }
        return false;
    }
}

// --- Form Handlers ---

// This handler is used only by the signup form on the pricing page
async function handleSignupForPricing(event) {
    event.preventDefault();
    const signupError = document.getElementById('signup-error');
    signupError.textContent = ''; // Clear previous errors
    const form = event.target;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite_token');

    const payload = {
        firstName: form.querySelector('#signup-firstname').value,
        lastName: form.querySelector('#signup-lastname').value,
        email: form.querySelector('#signup-email').value,
        password: form.querySelector('#signup-password').value,
        artistBandName: inviteToken ? "Invited Member" : form.querySelector('#signup-artist-name').value,
        inviteToken: inviteToken || null
    };

    try {
        await apiRequest('signup', payload, 'POST');
        const credentials = { email: payload.email, password: payload.password };

        // Invited members go straight to the tool. New band admins/solos go back to the pricing page.
        const redirectTo = inviteToken ? '/ProjectAnthem.html' : '/pricing.html';
        await performLogin(credentials, redirectTo);

    } catch(error) {
        signupError.textContent = error.message;
    }
}

// This handler is used by the login form in the modal
async function handleLogin(event) {
    event.preventDefault();
    const loginError = document.getElementById('login-error');
    loginError.textContent = '';
    const form = event.target;
    const payload = {
        email: form.querySelector('#login-email').value,
        password: form.querySelector('#login-password').value
    };
    try {
        await performLogin(payload);
    } catch(error) {
        loginError.textContent = error.message;
    }
}

async function performLogin(credentials, redirectTo = null) {
    const result = await apiRequest('login', credentials, 'POST');
    if (result.token) {
        localStorage.setItem('user_token', result.token);
        
        // If a specific redirect is provided, use it.
        if (redirectTo) {
            window.location.href = redirectTo;
            return;
        }

        // Otherwise, determine redirect based on subscription status
        const user = getUserPayload(); 
        const validStatuses = ['active', 'trialing', 'admin_granted'];
        const hasAccess = user && (user.role === 'admin' || validStatuses.includes(user.subscription_status));
        
        window.location.href = hasAccess ? '/ProjectAnthem.html' : '/pricing.html';
    } else {
        throw new Error("Login failed: No token returned.");
    }
}

// --- Modal Controls (called from nav and inline scripts) ---
function openModal(view) {
    const authModal = document.getElementById('auth-modal');
    if(authModal) {
        const loginView = document.getElementById('login-view');
        if(view === 'login' && loginView) {
            authModal.classList.remove('hidden'); 
            authModal.classList.add('flex'); 
            loginView.classList.remove('hidden');
            const loginForm = document.getElementById('login-form');
            if (loginForm && !loginForm.dataset.listenerAttached) {
                 loginForm.addEventListener('submit', handleLogin);
                 loginForm.dataset.listenerAttached = 'true';
            }
        }
    }
}
