// --- START OF FILE public/js/auth.js ---

import { login } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // This runs on every page load and is the key to the definitive fix.
    updateNav();
    
    // REDIRECTION LOGIC:
    const user = getUserPayload();
    const currentPath = window.location.pathname.toLowerCase();
    const isPublicPage = ['/proanthem_index.html', '/pricing.html', '/demo.html', '/'].some(page => currentPath.endsWith(page));

    // If a logged-in user lands on a public page, they should always be sent to their dashboard.
    // This breaks the loop by providing a single, authoritative redirect.
    if (user && isPublicPage) {
        window.location.href = '/dashboard.html';
        return; // Stop further script execution on this page
    }

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
        const content = document.querySelector('#tool-content, #band-content, #admin-content, #dashboard-content, #editor-content');
        if (content) {
            content.style.display = 'block';
            content.classList.remove('hidden');
        }
        return true;
    } else {
        window.location.href = '/pricing.html';
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

export async function performLogin(credentials) {
    try {
        const result = await login(credentials);
        if (result.token) {
            localStorage.setItem('user_token', result.token);
            // After storing the token, reload the page.
            // The logic at the top of the script will now handle the redirect correctly.
            window.location.reload();
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
