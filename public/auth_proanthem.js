// This is the unified authentication script for the entire ProAnthem site.

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    const signupFormPricing = document.querySelector("#signup-view form");
    if(signupFormPricing) signupFormPricing.addEventListener('submit', handleSignupForPricing);
});

// --- Core Auth & API Functions ---
function getToken() { return localStorage.getItem('user_token'); }

function getUserPayload() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user || null;
    } catch (e) {
        console.error('Failed to parse token:', e);
        logout();
        return null;
    }
}

function logout() {
    localStorage.removeItem('user_token');
    window.location.href = '/proanthem_index.html';
}

function updateNav() {
    const user = getUserPayload();
    const navAuthSection = document.querySelector("#nav-auth-section");
    if (!navAuthSection) return;

    if (user) {
        let buttonHtml = `<a href="/ProjectAnthem.html" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Tool</a>`;
        if (user.role === 'admin' || user.role === 'band_admin') { // Admins and Band Admins see this
             buttonHtml = `<a href="/band.html" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300 mr-4">Manage Band</a>` + buttonHtml;
        }
        if (user.role === 'admin') {
             buttonHtml = `<a href="/admin.html" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 mr-4">Admin Panel</a>` + buttonHtml;
        }
         buttonHtml += `<button onclick="logout()" class="ml-4 text-gray-300 hover:text-white">Log Out</button>`;
        navAuthSection.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
    } else {
        navAuthSection.innerHTML = `<button id="login-modal-button" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Log In</button>`;
        const loginBtn = document.getElementById('login-modal-button');
        if(loginBtn) {
            loginBtn.addEventListener('click', () => openModal('login'));
        }
    }
}

async function apiRequest(endpoint, data = null, method = 'GET') {
    const token = getToken();
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (data) options.body = JSON.stringify(data);
    try {
        const response = await fetch(`/api/${endpoint}`, options);
        if (response.status === 204) return null;
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message || `API Error: ${response.status}`);
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error);
        throw error;
    }
}

// --- Subscription & Access Control ---
function checkAccess() {
    const user = getUserPayload();
    const specialRoles = ['admin', 'band_admin', 'band_member'];
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    
    const hasSpecialRole = user && specialRoles.includes(user.role);
    const hasValidSubscription = user && validStatuses.includes(user.subscription_status);

    const hasAccess = hasSpecialRole || hasValidSubscription;
    
    const toolContent = document.getElementById('tool-content') || document.getElementById('band-content') || document.getElementById('admin-content');
    const accessDenied = document.getElementById('access-denied');
    
    if (!toolContent || !accessDenied) return true; 

    if (hasAccess) {
        accessDenied.classList.add('hidden');
        accessDenied.style.display = 'none';
        
        toolContent.classList.remove('hidden');
        toolContent.style.display = 'block';
        
        return true;
    } else {
        accessDenied.classList.remove('hidden');
        accessDenied.style.display = 'block';
        
        toolContent.classList.add('hidden');
        toolContent.style.display = 'none';
        
        const accessDeniedLink = accessDenied.querySelector('a');
        if (accessDeniedLink) {
            accessDeniedLink.textContent = user ? 'Manage Subscription' : 'Log In or Sign Up';
            accessDeniedLink.href = user ? '/pricing.html' : '/proanthem_index.html';
        }
        return false;
    }
}


// --- Form Handlers ---
async function handleSignupForPricing(event) {
    event.preventDefault();
    const signupError = document.getElementById('signup-error');
    signupError.textContent = '';
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
        const redirectTo = inviteToken ? '/ProjectAnthem.html' : '/pricing.html';
        await performLogin(credentials, redirectTo);
    } catch(error) {
        signupError.textContent = error.message;
    }
}

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
        if (redirectTo) {
            window.location.href = redirectTo;
            return;
        }

        const user = getUserPayload();
        const specialRoles = ['admin', 'band_admin', 'band_member'];
        const validStatuses = ['active', 'trialing', 'admin_granted'];
        
        const hasSpecialRole = user && specialRoles.includes(user.role);
        const hasValidSubscription = user && validStatuses.includes(user.subscription_status);
        const hasAccess = hasSpecialRole || hasValidSubscription;
        
        window.location.href = hasAccess ? '/ProjectAnthem.html' : '/pricing.html';
    } else {
        throw new Error("Login failed: No token returned.");
    }
}

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
