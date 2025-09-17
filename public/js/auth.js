// --- START OF FILE public/js/auth.js ---

import { login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
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
        // Logged-in users see a dashboard link and other management links.
        let buttonHtml = `<a href="/dashboard.html" class="btn btn-secondary">Dashboard</a>`;
        if (user.role === 'admin') {
             buttonHtml = `<a href="/admin.html" class="btn btn-primary mr-4">Admin Panel</a>` + buttonHtml;
        }
        buttonHtml += `<button id="logout-button" class="ml-4 text-gray-400 hover:text-white">Log Out</button>`;
        navAuthSection.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
        document.getElementById('logout-button')?.addEventListener('click', logout);
    } else {
        // Logged-out users see a login button.
        navAuthSection.innerHTML = `<button id="login-modal-button" class="btn btn-secondary">Log In</button>`;
        const loginBtn = document.getElementById('login-modal-button');
        if(loginBtn) {
            loginBtn.addEventListener('click', () => openModal('login'));
        }
    }
}

export function checkAccess() {
    // MODIFIED: dashboard.html is now a primary authenticated page.
    const publicPages = ['/', '/proanthem_index.html', '/proanthem_index', '/pricing.html', '/pricing', '/demo.html', '/demo', '/construction.html', '/construction'];
    const currentPath = window.location.pathname.toLowerCase();
    
    // Allow access to public pages OR if the path starts with /bands/ (for public profiles)
    if (publicPages.includes(currentPath) || currentPath.startsWith('/bands/')) {
        return true;
    }

    const user = getUserPayload();
    if (!user) {
        window.location.href = '/proanthem_index.html';
        return false;
    }

    const validStatuses = ['active', 'trialing', 'admin_granted'];
    if (!validStatuses.includes(user.subscription_status) && user.role !== 'admin') {
        window.location.href = '/pricing.html';
        return false;
    }

    // Un-hide the main content of the authenticated page
    const content = document.querySelector('#tool-content, #band-content, #admin-content, #dashboard-content, #editor-content');
    if (content) {
        content.style.display = 'block'; // Or grid, flex, etc., depending on the page
        content.classList.remove('hidden');
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

export async function performLogin(credentials) {
    try {
        const result = await login(credentials);
        if (result.token) {
            localStorage.setItem('user_token', result.token);
            const user = getUserPayload();

            // --- THIS IS THE KEY CHANGE ---
            // After login, ALWAYS go to the new dashboard.
            // The dashboard itself will handle the password reset prompt if needed.
            // The only exception is if their subscription is invalid.
            const validStatuses = ['active', 'trialing', 'admin_granted'];
            const hasAccess = user.role === 'admin' || validStatuses.includes(user.subscription_status);
            
            if (user.force_reset) {
                // If they need to reset, send them to the tool page where the modal lives.
                // We'll redirect them to the dashboard AFTER they reset.
                window.location.href = '/ProjectAnthem.html';
            } else if (hasAccess) {
                window.location.href = '/dashboard.html';
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
