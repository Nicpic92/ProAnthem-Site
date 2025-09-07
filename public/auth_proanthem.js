document.addEventListener('DOMContentLoaded', () => {
    updateNav(); 
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    // Logic specifically for the pricing page signup form
    const signupFormPricing = document.querySelector("#signup-view form");
    if(signupFormPricing) signupFormPricing.addEventListener('submit', handleSignupForPricing);
});

// --- Core Auth & API Functions ---
function getToken() { return localStorage.getItem('user_token'); }
function getUserPayload() { /* ... unchanged ... */ }
function logout() { /* ... unchanged ... */ }

function updateNav() {
    const user = getUserPayload();
    const navAuthSection = document.querySelector("#nav-auth-section");
    
    if (navAuthSection) {
        if (user) {
            let buttonHtml = `<a href="/ProjectAnthem.html" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Tool</a>`;
            if (user.role === 'admin') {
                buttonHtml = `<a href="/admin.html" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 mr-4">Admin Panel</a>` + buttonHtml;
            }
            buttonHtml += `<button onclick="logout()" class="ml-4 text-gray-300 hover:text-white">Log Out</button>`;
            navAuthSection.innerHTML = `<div class="flex items-center">${buttonHtml}</div>`;
        } else {
            navAuthSection.innerHTML = `<button id="login-modal-button" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300">Log In</button>`;
            const loginBtn = document.getElementById('login-modal-button');
            if(loginBtn) loginBtn.addEventListener('click', () => openModal('login'));
        }
    }
    
    // --- NEW: Logic to show/hide "Manage Band" button in the main tool ---
    const manageBandBtn = document.getElementById('manageBandBtn');
    if (manageBandBtn && user && (user.role === 'band_admin' || user.role === 'admin')) {
        manageBandBtn.style.display = 'block';
    }
}

async function apiRequest(endpoint, data = null, method = 'GET') { /* ... unchanged ... */ }
function checkAccess() { /* ... unchanged ... */ }

// --- Signup logic specifically for the pricing page ---
async function handleSignupForPricing(event) {
    event.preventDefault();
    const signupError = document.getElementById('signup-error');
    const form = event.target;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite_token');

    const payload = {
        firstName: form.querySelector('#signup-firstname').value,
        lastName: form.querySelector('#signup-lastname').value,
        email: form.querySelector('#signup-email').value,
        password: form.querySelector('#signup-password').value,
        // Send these values depending on whether it's a new band or an invite
        artistBandName: inviteToken ? "Invited Member" : form.querySelector('#signup-artist-name').value,
        inviteToken: inviteToken || null
    };

    try {
        await apiRequest('signup', payload, 'POST');
        // On successful signup, immediately log them in
        const credentials = { email: payload.email, password: payload.password };
        if (inviteToken) {
            // Invited members go straight to the tool
            await performLogin(credentials, '/ProjectAnthem.html');
        } else {
            // New band admins go back to the pricing page to choose their plan
            await performLogin(credentials, '/pricing.html');
        }
    } catch(error) {
        signupError.textContent = error.message;
    }
}


// --- Form Handlers ---
async function handleLogin(event) { /* ... unchanged ... */ }
async function performLogin(credentials, redirectTo = null) {
    const result = await apiRequest('login', credentials, 'POST');
    if (result.token) {
        localStorage.setItem('user_token', result.token);
        if (redirectTo) {
            window.location.href = redirectTo;
            return;
        }

        const user = getUserPayload(); 
        const validStatuses = ['active', 'trialing', 'admin_granted'];
        const hasAccess = user && (user.role === 'admin' || validStatuses.includes(user.subscription_status));
        window.location.href = hasAccess ? '/ProjectAnthem.html' : '/pricing.html';
    } else {
        throw new Error("Login failed: No token returned.");
    }
}

function openModal(view) { /* ... unchanged ... */ }
