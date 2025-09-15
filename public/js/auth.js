// --- START OF FILE public/js/auth.js ---

import { login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    // This script now only handles the generic login modal form, not page-specific forms.
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
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

export function checkAccess() {
    const publicPages = [
        '/', 
        '/proanthem_index.html', '/proanthem_index',
        '/pricing.html', '/pricing',
        '/demo.html', '/demo',
        '/construction.html', '/construction',
        '/band-profile.html', '/band-profile'
    ];
    
    const currentPath = window.location.pathname.toLowerCase();

    if (publicPages.includes(currentPath) || currentPath.startsWith('/bands/')) {
        return true; 
    }

    const user = getUserPayload();
    if (!user) {
        window.location.href = '/proanthem_index.html';
        return false;
    }
    
    const specialRoles = ['admin', 'band_admin', 'band_member'];
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    
    const hasSpecialRole = specialRoles.includes(user.role);
    const hasValidSubscription = validStatuses.includes(user.subscription_status);
    const hasAccess = hasSpecialRole || hasValidSubscription;
    
    const content = document.getElementById('tool-content') || document.getElementById('band-content') || document.getElementById('admin-content');
    const accessDenied = document.getElementById('access-denied');
    
    if (!content || !accessDenied) return true;

    if (hasAccess) {
        accessDenied.classList.add('hidden');
        content.classList.remove('hidden');
        content.style.display = 'block'; 
        return true;
    } else {
        accessDenied.classList.remove('hidden');
        content.classList.add('hidden');
        content.style.display = 'none';
        
        const accessDeniedLink = accessDenied.querySelector('a');
        if (accessDeniedLink) {
            accessDeniedLink.textContent = 'Manage Subscription';
            accessDeniedLink.href = '/pricing.html';
        }
        return false;
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

// This function is now EXPORTED so other pages (like pricing.html) can use it.
export async function performLogin(credentials, redirectTo = null) {
    try {
        const result = await login(credentials);
        if (result.token) {
            localStorage.setItem('user_token', result.token);
            
            if (redirectTo) {
                window.location.href = redirectTo;
                return;
            }
            
            // --- FIX: Restored robust redirect logic ---
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
