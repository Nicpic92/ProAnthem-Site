// This script is for proanthem_index.html
document.addEventListener('DOMContentLoaded', () => {
    const authModal = document.getElementById('auth-modal');
    const closeModalButton = document.getElementById('close-modal-button');
    const loginForm = document.getElementById('login-form');

    const closeModal = () => authModal.classList.add('hidden');

    window.openModal = function(view) {
        if (view === 'login' && authModal) {
            authModal.classList.remove('hidden');
        }
    };
    
    async function handleLogin(event) {
        event.preventDefault();
        const loginError = document.getElementById('login-error');
        loginError.textContent = '';
        const button = loginForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Logging In...';
        
        const payload = {
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
        };
        try {
            // performLogin is a global function from auth.js
            await performLogin(payload);
        } catch(error) {
            loginError.textContent = error.message;
            button.disabled = false;
            button.textContent = 'Log In';
        }
    }
    
    if (authModal) {
        closeModalButton.addEventListener('click', closeModal);
        authModal.addEventListener('click', (e) => { if (e.target === authModal) closeModal(); });
        loginForm.addEventListener('submit', handleLogin);
    }
});
