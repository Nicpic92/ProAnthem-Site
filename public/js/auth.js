// --- START OF FILE public/js/auth.js ---

import { login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
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
        // This logic is correct: only admins see the Manage Band button.
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
        '/band-profile.html', '/band-profile',
        '/admin.html', '/admin'
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
    
    // --- THIS IS THE FIX ---
    // The previous logic was flawed. This is the correct way to check permissions.

    // 1. Define roles that have subscription-based access (can use the main tool)
    const subscriptionRoles = ['solo', 'band_admin'];
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    
    // 2. Determine if the user has a valid subscription
    const hasValidSubscription = subscriptionRoles.includes(user.role) && validStatuses.includes(user.subscription_status);
    
    // 3. System admins always have access
    const isSystemAdmin = user.role === 'admin';

    // 4. Invited band members have special access
    const isBandMember = user.role === 'band_member';

    // Check access for the main tool page
    if (currentPath.includes('projectanthem')) {
        if (hasValidSubscription || isSystemAdmin || isBandMember) {
            // All these roles can use the tool
        } else {
            // User's subscription is inactive, redirect them to pricing
            window.location.href = '/pricing.html';
            return false;
        }
    }
    
    // Check access for the band management page
    if (currentPath.includes('band.html') || currentPath.includes('band')) {
        // Any member of a band can VIEW the band page
        if (!isSystemAdmin && !isBandMember && user.role !== 'band_admin') {
            window.location.href = '/projectanthem_index.html'; // Or show an error
            return false;
        }
    }
    
    // If we've reached this point, the user is authorized for the page they are on.
    // Now, we just show/hide the content vs the access denied message.
    const content = document.getElementById('tool-content') || document.getElementById('band-content') || document.getElementById('admin-content');
    const accessDenied = document.getElementById('access-denied');
    
    if (content) content.style.display = 'block';
    if (accessDenied) accessDenied.style.display = 'none';

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
        const result = await login(credentials);
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
