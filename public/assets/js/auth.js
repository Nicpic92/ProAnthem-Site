// This is the unified authentication script for the entire ProAnthem site.

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
});

function getToken() {
    return localStorage.getItem('user_token');
}

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
    if (!window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('/proanthem_index.html')) {
        window.location.href = '/proanthem_index.html';
    } else {
        window.location.reload();
    }
}

function updateNav() {
    const user = getUserPayload();
    const navAuthSection = document.getElementById('nav-auth-section');
    if (!navAuthSection) return;

    if (user) {
        let buttonHtml = `<a href="/ProjectAnthem.html" class="btn btn-primary">Tool</a>`;
        if (user.role === 'admin' || user.role === 'band_admin') {
             buttonHtml = `<a href="/Band.html" class="btn btn-secondary mr-4">Manage Band</a>` + buttonHtml;
        }
        if (user.role === 'admin') {
             buttonHtml = `<a href="/admin.html" class="btn btn-danger mr-4">Admin Panel</a>` + buttonHtml;
        }
         buttonHtml += `<button onclick="logout()" class="ml-4 text-gray-300 hover:text-white font-semibold">Log Out</button>`;
        navAuthSection.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
    } else {
        navAuthSection.innerHTML = `<a href="/pricing.html" class="btn btn-primary">Sign Up</a><button id="login-modal-button" class="ml-4 text-gray-300 hover:text-white font-semibold">Log In</button>`;
        const loginBtn = document.getElementById('login-modal-button');
        if(loginBtn && typeof openModal === 'function') {
            loginBtn.addEventListener('click', () => openModal('login'));
        }
    }
}

async function apiRequest(endpoint, data = null, method = 'GET') {
    const url = `/api/${endpoint}`;
    const token = getToken();

    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const responseData = response.status === 204 ? null : await response.json();

        if (!response.ok) {
            const message = responseData?.message || `API Error: ${response.status}`;
            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                logout();
            }
            throw new Error(message);
        }
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error);
        throw error;
    }
}

function checkAccess() {
    const user = getUserPayload();
    const specialRoles = ['admin', 'band_admin', 'band_member'];
    const validStatuses = ['active', 'trialing', 'admin_granted'];
    const hasAccess = user && (specialRoles.includes(user.role) || validStatuses.includes(user.subscription_status));
    
    const toolContent = document.getElementById('tool-content') || document.getElementById('band-content') || document.getElementById('admin-content');
    const accessDenied = document.getElementById('access-denied');
    
    if (!toolContent || !accessDenied) return true;

    if (hasAccess) {
        accessDenied.style.display = 'none';
        toolContent.style.display = 'block';
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

async function performLogin(credentials, redirectTo = null) {
    const result = await apiRequest('login', credentials, 'POST');
    if (result.token) {
        localStorage.setItem('user_token', result.token);
        const user = JSON.parse(atob(result.token.split('.')[1])).user;

        if (redirectTo) {
            window.location.href = redirectTo;
            return;
        }
        
        if(user.force_reset){
             window.location.href = '/ProjectAnthem.html';
             return;
        }
        
        const specialRoles = ['admin', 'band_admin', 'band_member'];
        const validStatuses = ['active', 'trialing', 'admin_granted'];
        const hasAccess = user && (specialRoles.includes(user.role) || validStatuses.includes(user.subscription_status));
        
        window.location.href = hasAccess ? '/ProjectAnthem.html' : '/pricing.html';
    } else {
        throw new Error("Login failed: No token returned.");
    }
}
