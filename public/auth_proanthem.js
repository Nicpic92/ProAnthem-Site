// This is the new, unified authentication script for the entire ProAnthem site.

document.addEventListener('DOMContentLoaded', () => {
    // This part runs on every page to update the nav bar.
    updateNav();

    // These parts only run if a login or signup form is present on the page.
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});


// --- Core Functions (Used Everywhere) ---

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
    localStorage.removeItem('userRole'); 
    window.location.href = '/proanthem_index.html';
}

function updateNav() {
    const user = getUserPayload();
    const loginButton = document.getElementById('login-modal-button');
    const navAuthSection = document.getElementById('nav-auth-section'); // For admin.html

    if (loginButton) { // For proanthem_index.html
        if (user) {
            let buttonHtml = `<a href="/ProjectAnthem.html" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Dashboard</a>`;
            if (user.role === 'admin') {
                 buttonHtml = `<a href="/admin.html" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 mr-4">Admin Panel</a>` + buttonHtml;
            }
            loginButton.parentElement.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
        } else {
            loginButton.textContent = 'Log In / Sign Up';
            loginButton.onclick = () => openModal('login');
        }
    }

    if (navAuthSection) { // For admin.html
         if (user) {
            let navHtml = `<a href="/ProjectAnthem.html" class="text-gray-600 hover:text-indigo-600 font-medium">Main Tool</a>`;
             if (user.role === 'admin') {
                 navHtml += `<a href="/admin.html" class="text-indigo-600 hover:text-indigo-800 font-bold ml-4">Admin Panel</a>`;
            }
            navHtml += `<button onclick="logout()" class="ml-4 bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Log Out</button>`;
            navAuthSection.innerHTML = navHtml;
        } else {
             navAuthSection.innerHTML = `<a href="/proanthem_index.html" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Log In</a>`;
        }
    }
}

// --- FIX: The apiRequest function is upgraded to handle authentication ---
async function apiRequest(endpoint, data = null, method = 'GET') {
    const token = getToken();
    
    const options = {
        method,
        headers: { 
            'Content-Type': 'application/json',
        },
    };

    // If a token exists, add the Authorization header to the request.
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        // Use the full API path, assuming Netlify redirects are set up
        const response = await fetch(`/api/${endpoint}`, options);
        
        // Handle cases with no JSON response body (like DELETE 204)
        if (response.status === 204) {
            return null;
        }
        
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.message || `API Error: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error);
        throw error;
    }
}


// --- Form Handlers (Only used on pages with forms) ---

async function handleSignup(event) {
    event.preventDefault();
    const signupError = document.getElementById('signup-error');
    signupError.textContent = '';
    
    const form = event.target;
    const payload = {
        firstName: form.querySelector('#signup-firstname').value,
        lastName: form.querySelector('#signup-lastname').value,
        artistBandName: form.querySelector('#signup-artist-name').value,
        email: form.querySelector('#signup-email').value,
        password: form.querySelector('#signup-password').value,
        source: 'proanthem'
    };

    try {
        await apiRequest('signup', payload, 'POST');
        await performLogin({ email: payload.email, password: payload.password });
    } catch (error) {
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

async function performLogin(credentials) {
    const result = await apiRequest('login', credentials, 'POST');
    if (result.token) {
        localStorage.setItem('user_token', result.token);
        window.location.href = '/ProjectAnthem.html';
    } else {
        throw new Error("Login failed: No token returned.");
    }
}

function openModal(view) {
    const authModal = document.getElementById('auth-modal');
    if(authModal) {
         const loginView = document.getElementById('login-view');
        const signupView = document.getElementById('signup-view');
        authModal.classList.remove('hidden'); 
        authModal.classList.add('flex'); 
        loginView.classList.toggle('hidden', view !== 'login'); 
        signupView.classList.toggle('hidden', view !== 'signup');
    }
}
