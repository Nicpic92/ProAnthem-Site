// --- START OF FILE public/js/auth.js ---

import { login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    // Re-establishes that this script handles the main login modal form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

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
    const publicPages = ['/', '/proanthem_index.html', '/proanthem_index', '/pricing.html', '/pricing', '/demo.html', '/demo', '/construction.html', '/construction', '/band-profile.html', '/band-profile', '/admin.html', '/admin'];
    const currentPath = window.location.pathname.toLowerCase();

    // Public pages are always accessible
    if (publicPages.includes(currentPath) || currentPath.startsWith('/bands/')) {
        return true;
    }

    const user = getUserPayload();
    if (!user) {
        window.location.href = '/proanthem_index.html';
        return false;
    }

    // --- THIS IS THE REWRITTEN AND FIXED LOGIC ---
    // Rule 1: System administrators always have access.
    if (user.role === 'admin') {
        const content = document.getElementById('tool-content') || document.getElementById('band-content') || document.getElementById('admin-content');
        if (content) {
            content.style.display = 'block';
            content.classList.remove('hidden');
        }
        return true;
    }
    
    // Rule 2: For all other users, their token's subscription status must be valid.
    // This correctly handles solo users, band_admins, and band_members who inherit their admin's 'admin_granted' status.
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    const hasValidStatus = validStatuses.includes(user.subscription_status);

    const isToolPage = currentPath.includes('projectanthem');
    const isBandPage = currentPath.includes('band.html') || currentPath.includes('band');

    if (isToolPage && !hasValidStatus) {
        window.location.href = '/pricing.html';
        return false;
    }
    
    // Rule 3: The band page requires being part of a band (any role).
    if (isBandPage && user.role !== 'band_admin' && user.role !== 'band_member') {
        window.location.href = '/proanthem_index.html';
        return false;
    }

    const content = document.getElementById('tool-content') || document.getElementById('band-content') || document.getElementById('admin-content');
    const accessDenied = document.getElementById('access-denied');
    
    if (content && accessDenied) {
        content.style.display = 'block';
        content.classList.remove('hidden');
        accessDenied.style.display = 'none';
    }
    
    return true;
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

export async function performLogin(credentials, redirectTo = null) {
    try {
        const result = await login(credentials); // This will throw on failure
        if (result.token) {
            localStorage.setItem('user_token', result.token);
            if (redirectTo) {
                window.location.href = redirectTo;
                return;
            }
            const user = getUserPayload();
            const validStatuses = ['active', 'trialing', 'admin_granted'];
            const hasAccess = user.role === 'admin' || validStatuses.includes(user.subscription_status);
            
            window.location.href = hasAccess ? '/ProjectAnthem.html' : '/pricing.html';
        } else {
            throw new Error("Login failed: No token returned.");
        }
    } catch(error) {
        throw error; // Re-throw the error to be caught by handleLogin
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
