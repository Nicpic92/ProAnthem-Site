// This file is referenced by admin.html and provides shared authentication
// and API communication functionality for the Spreadsheet Simplicity side of the site.

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

function getUserRole() {
    const user = getUserPayload();
    return user ? user.role : null;
}

function logout() {
    localStorage.removeItem('user_token');
    localStorage.removeItem('userRole');
    if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/';
    } else {
        window.location.reload();
    }
}

function updateNav() {
    const user = getUserPayload();
    const navAuthSection = document.getElementById('nav-auth-section');
    const mobileNavAuthSection = document.getElementById('mobile-nav-auth-section');
    if (!navAuthSection) return;

    let navHtml = '';
    if (user) {
        navHtml = `
            <span class="text-gray-600 font-medium hidden lg:inline">Welcome, ${user.name || user.email}</span>
            ${user.role === 'admin' ? '<a href="/admin.html" class="text-indigo-600 hover:text-indigo-800 font-bold ml-4">Admin</a>' : ''}
            <a href="/dashboard.html" class="text-gray-600 hover:text-indigo-600 font-medium ml-4">Dashboard</a>
            <button onclick="logout()" class="ml-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">
                Log Out
            </button>
        `;
    } else {
        navHtml = `
            <a href="/login.html" class="text-gray-600 hover:text-indigo-600 font-medium">Log In</a>
            <a href="/signup.html" class="ml-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">
                Sign Up
            </a>
        `;
    }

    navAuthSection.innerHTML = navHtml;
    if (mobileNavAuthSection) mobileNavAuthSection.innerHTML = navHtml.replace(/ml-4/g, 'block py-2 px-4 text-sm');
}

async function apiRequest(endpoint, data = null, method = 'GET') {
    // Assuming Netlify functions are mapped to /api/ via netlify.toml or similar
    const url = `/api/${endpoint}`;
    const token = getToken();

    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && (method === 'POST' || method === 'PUT')) {
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
