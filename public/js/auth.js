// --- START OF FILE public/js/auth.js ---

import { login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // Use the new handler for the login form on the homepage
        loginForm.addEventListener('submit', handleLoginAndRedirect);
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
        let buttonHtml = `<a href="/dashboard.html" class="btn btn-secondary">Dashboard</a>`;
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

    const validStatuses = ['active', 'trialing', 'admin_granted', 'free'];
    if (!validStatuses.includes(user.subscription_status) && user.role !== 'admin') {
        window.location.href = '/pricing.html';
        return false;
    }

    const content = document.querySelector('#tool-content, #band-content, #admin-content, #dashboard-content, #editor-content');
    if (content) {
        content.style.display = 'block';
        content.classList.remove('hidden');
    }
    
    return true;
}

// Renamed from handleLogin to be more specific to its use case on the homepage modal
async function handleLoginAndRedirect(event) {
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
        
        // After login is successful and token is stored, redirect.
        const user = getUserPayload();
        if (user.force_reset) {
            window.location.href = '/ProjectAnthem.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    } catch(error) {
        loginError.textContent = error.message;
    }
}

// This function now ONLY handles getting and storing the token. It does not redirect.
export async function performLogin(credentials) {
    try {
        const result = await login(credentials);
        if (result.token) {
            localStorage.setItem('user_token', result.token);
        } else {
            throw new Error("Login failed: No token returned.");
        }
    } catch(error) {
        // Re-throw the error so the calling function can handle UI updates
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
                 // The event listener is now attached in DOMContentLoaded
                 loginForm.dataset.listenerAttached = 'true';
            }
        }
    }
}

// --- END OF FILE public/js/auth.js ---
