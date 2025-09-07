document.addEventListener('DOMContentLoaded', () => {
    // This is a PUBLIC key, safe to be exposed in client-side code.
    const stripe = Stripe('pk_live_51Ryc5tGbxgsv5aJ6w9YDK0tE0XVnCz1XspXdarf3DYoE7g7YXLut87vm2AUsAjVmHwXTnE6ZXalKohb17u3mA8wa008pR7uPYA');
    const statusMessage = document.getElementById('status-message');

    const user = getUserPayload();
    if (!user) {
        document.getElementById('signup-view').style.display = 'block';
        document.getElementById('pricing-view').style.display = 'none';
        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', handleSignupForPricing);
        }
        const loginLink = document.getElementById('login-link');
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                // This relies on the home page's modal logic
                window.location.href = '/proanthem_index.html?login=true'; 
            });
        }
    } else {
         document.getElementById('signup-view').style.display = 'none';
         document.getElementById('pricing-view').style.display = 'block';
    }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout_canceled')) {
        statusMessage.textContent = 'Checkout canceled. Your trial has not started. Please choose a plan to continue.';
        statusMessage.classList.add('text-yellow-400');
    }

    async function handleSignupForPricing(event) {
        event.preventDefault();
        const signupError = document.getElementById('signup-error');
        signupError.textContent = '';
        const form = event.target;
        const button = form.querySelector('button[type="submit"]');
        const originalButtonText = button.textContent;
        button.disabled = true;
        button.textContent = 'Creating Account...';

        const payload = {
            firstName: form.querySelector('#signup-firstname').value,
            lastName: form.querySelector('#signup-lastname').value,
            artistBandName: form.querySelector('#signup-artist-name').value,
            email: form.querySelector('#signup-email').value,
            password: form.querySelector('#signup-password').value
        };
        try {
            await apiRequest('signup', payload, 'POST');
            // Log the user in and redirect them to the pricing page to choose a plan
            await performLogin({ email: payload.email, password: payload.password }, '/pricing.html');
        } catch(error) {
            signupError.textContent = error.message;
            button.disabled = false;
            button.textContent = originalButtonText;
        }
    }
    
    window.startCheckout = async function(plan) {
        try {
            const { id: sessionId } = await apiRequest('stripe/create-checkout-session', { plan }, 'POST');
            const { error } = await stripe.redirectToCheckout({ sessionId });
            if (error) {
                alert(error.message);
            }
        } catch (error) {
             alert('Error starting checkout: ' + error.message);
        }
    }
    
    window.manageBilling = async function() {
        try {
            const { url } = await apiRequest('stripe/create-customer-portal', {}, 'POST');
            window.location.href = url;
        } catch(error) {
             alert('Error opening customer portal: ' + error.message);
        }
    }
});
