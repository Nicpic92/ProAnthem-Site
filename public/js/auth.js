// --- START OF FILE public/js/auth.js ---

// This file handles user sessions, access control, and login/signup forms.
import { login, signup } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    const signupFormPricing = document.querySelector("#signup-view form");
    if(signupFormPricing) signupFormPricing.addEventListener('submit', handleSignupForPricing);
});

// --- Core Auth & Session Functions ---
export function getToken() { return localStorage.getItem('user_token'); }

export function getUserPayload() {
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
        let buttonHtml = `<a href="/ProjectAnthem.html" class="btn btn-secondary">Tool</a>`;
        if (user.role === 'admin' || user.role === 'band_admin') {
             buttonHtml = `<a href="/band.html" class="btn btn-secondary mr-4">Manage Band</a>` + buttonHtml;
        }
        if (user.role === 'admin') {
             buttonHtml = `<a href="/admin.html" class="btn btn-primary mr-4">Admin Panel</a>` + buttonHtml;
        }
         buttonHtml += `<button id="logout-button" class="ml-4 text-gray-400 hover:text-white">Log Out</button>`;
        navAuthSection.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
        
        document.getElementById('logout-button')?.addEventListener('click', logout);

    } else {
        navAuthSection.innerHTML = `<button id="login-modal-button" class="btn btn-secondary">Log In</button>`;
        const loginBtn = document.getElementById('login-modal-button');
        if(loginBtn) {
            loginBtn.addEventListener('click', () => openModal('login'));
        }
    }
}

// --- Subscription & Access Control ---
export function checkAccess() {
    const user = getUserPayload();
    if (!user) {
        return false; // User is not logged in, access denied.
    }
    
    const specialRoles = ['admin', 'band_admin', 'band_member'];
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    
    const hasSpecialRole = specialRoles.includes(user.role);
    const hasValidSubscription = validStatuses.includes(user.subscription_status);
    
    // Return true if they have a special role OR a valid subscription, otherwise false.
    return hasSpecialRole || hasValidSubscription;
}

// --- Form Handlers ---
async function handleSignupForPricing(event) {
    event.preventDefault();
    const signupError = document.getElementById('signup-error');
    signupError.textContent = 'Signing up...';
    const form = event.target;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite_token');

    const payload = {
        firstName: form.querySelector('#signup-firstname').value,
        lastName: form.querySelector('#signup-lastname').value,
        email: form.querySelector('#signup-email').value,
        password: form.querySelector('#signup-password').value,
        artistBandName: inviteToken ? "Invited Member" : form.querySelector('#signup-artist-name').value,
        inviteToken: inviteToken || null,
    };
    
    const pendingSongJSON = localStorage.getItem('pendingSong');
    if (pendingSongJSON) {
        try {
            payload.pendingSong = JSON.parse(pendingSongJSON);
        } catch (e) { console.error("Could not parse pending song.") }
    }

    try {
        await signup(payload);
        if (pendingSongJSON) localStorage.removeItem('pendingSong');
        const credentials = { email: payload.email, password: payload.password };
        const redirectTo = inviteToken || payload.pendingSong ? '/ProjectAnthem.html' : '/pricing.html';
        await performLogin(credentials, redirectTo);
    } catch(error) {
        signupError.textContent = error.message;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const loginError = document.getElementById('login-error');
    loginError.textContent = 'Logging in...';
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
    try {
        const result = await login(credentials);
        if (result.token) {
            localStorage.setItem('user_token', result.token);
            
            if (redirectTo) {
                window.location.href = redirectTo;
                return;
            }

            if (checkAccess()) {
                window.location.href = '/ProjectAnthem.html';
            } else {
                window.location.href = '/pricing.html';
            }
        } else {
            throw new Error("Login failed: No token returned.");
        }
    } catch(error) {
        throw error;
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

// --- END OF FILE public/js/auth.js ---
