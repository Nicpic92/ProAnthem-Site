// --- Authentication for ProAnthem ---

// This wrapper ensures the code only runs after the HTML page is fully loaded.
document.addEventListener('DOMContentLoaded', () => {

    // Re-usable API request function
    async function apiRequest(endpoint, data = null, method = 'POST') {
        const options = {
            method,
            headers: { 
                'Content-Type': 'application/json',
                // ProAnthem's tool will eventually need its own token logic,
                // but for login/signup, we don't send one.
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

    // Signup Handler for ProAnthem
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
            source: 'proanthem' // Crucial flag for the backend
        };

        try {
            const result = await apiRequest('signup', payload, 'POST');
            // After signup, attempt to log the user in directly
            await performLogin({ email: payload.email, password: payload.password });
        } catch (error) {
            signupError.textContent = error.message;
        }
    }

    // Login Handler
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
    
    // Reusable login logic
    async function performLogin(credentials) {
        const result = await apiRequest('login', credentials, 'POST');
        if (result.token) {
            // Store token for future authenticated requests within the ProAnthem app
            localStorage.setItem('user_token', result.token);
            const decodedToken = JSON.parse(atob(result.token.split('.')[1]));
            if (decodedToken.user && decodedToken.user.role) {
                localStorage.setItem('userRole', decodedToken.user.role);
            }
            // Redirect to the main ProAnthem tool
            window.location.href = '/ProjectAnthem.html';
        } else {
            throw new Error("Login failed: No token returned.");
        }
    }


    // Attach listeners
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});
