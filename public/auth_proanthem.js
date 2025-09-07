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
    // We remove the redundant userRole item for consistency
    localStorage.removeItem('userRole'); 
    window.location.href = '/proanthem_index.html';
}

function updateNav() {
    // This function checks the login status and updates the header buttons.
    const user = getUserPayload();
    const loginButton = document.getElementById('login-modal-button');

    if (loginButton) {
        if (user) {
            let buttonHtml = 'Dashboard';
            // Prepend the Admin button if the user is an admin
            if (user.role === 'admin') {
                 buttonHtml = `<a href="/admin.html" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 mr-4">Admin Panel</a>` + buttonHtml;
            }
            
            loginButton.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
            loginButton.onclick = () => window.location.href = '/ProjectAnthem.html';
            
        } else {
            loginButton.textContent = 'Log In / Sign Up';
            loginButton.onclick = () => openModal('login'); // Re-attach modal open function
        }
    }
}

async function apiRequest(endpoint, data = null, method = 'POST') {
    const options = {
        method,
        headers: { 
            'Content-Type': 'application/json',
        },
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    try {
        const response = await fetch(`/api/${endpoint}`, options);
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.message || `API Request Error to ${endpoint}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error.message);
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
        // No longer need to store userRole separately
        window.location.href = '/ProjectAnthem.html';
    } else {
        throw new Error("Login failed: No token returned.");
    }
}

// Re-add a reference to openModal if it's not globally available after this script runs
// This is needed because the main page's inline script might not see the nav update.
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
