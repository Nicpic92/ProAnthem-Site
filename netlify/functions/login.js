<!-- START OF FILE public/pricing.html -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pricing - ProAnthem</title>
    <script src="https://js.stripe.com/v3/"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="marketing flex flex-col min-h-screen">

    <header class="container mx-auto p-6 flex justify-between items-center">
        <a href="/proanthem_index.html" class="flex items-center space-x-4">
            <img src="/assets/logo_pa.jpg" alt="ProAnthem Logo" class="h-12">
            <h1 class="text-4xl font-bold">ProAnthem</h1>
        </a>
        <div id="nav-auth-section">
             <!-- Populated by auth script -->
        </div>
    </header>

    <main class="container mx-auto px-6 py-12 flex-grow">
        <!-- VIEW FOR LOGGED-IN (FREE) USERS TO UPGRADE -->
        <div id="upgrade-view" class="hidden">
            <div class="text-center">
                 <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight">
                    Upgrade to Unlock Your Full Potential.
                </h1>
                <p class="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
                    You're currently on the Free plan. Upgrade to a paid plan to unlock unlimited songs, interactive tab editors, the Show Builder, and all band management tools.
                </p>
                <p class="mt-2 font-bold text-indigo-400">All paid plans begin with a 3-day free trial.</p>
            </div>
            <div class="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <!-- SOLO PLAN (Upgrade View) -->
                <div class="bg-gray-800 p-8 rounded-xl border border-gray-700 flex flex-col">
                    <h2 class="text-3xl font-bold">Solo</h2>
                    <p class="text-gray-400 mt-2">The complete toolkit for the individual artist.</p>
                    <div class="my-6"><span class="text-5xl font-bold">$9</span><span class="text-gray-400">/ month</span></div>
                    <p class="text-center text-gray-300 mb-6">or $90 per year (2 months free)</p>
                    <ul class="space-y-4 text-gray-300 flex-grow">
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span><strong>Unlimited</strong> Songs</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Interactive Tab & Drum Editors</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Show Builder & Live View</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Record Voice Memos</span></li>
                    </ul>
                    <button id="checkout-solo" class="btn btn-secondary mt-8 w-full font-bold py-3">Start 3-Day Solo Trial</button>
                </div>
                <!-- BAND PLAN (Upgrade View) -->
                 <div class="bg-gray-800 p-8 rounded-xl border-2 border-indigo-500 flex flex-col">
                    <h2 class="text-3xl font-bold">Band</h2>
                    <p class="text-gray-400 mt-2">Everything for your whole team. No per-user fees.</p>
                     <div class="my-6"><span class="text-5xl font-bold">$19</span><span class="text-gray-400">/ month</span></div>
                    <p class="text-center text-gray-300 mb-6">or $190 per year (2 months free)</p>
                    <ul class="space-y-4 text-gray-300 flex-grow">
                        <li class="font-bold flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Everything in Solo, plus:</span></li>
                        <li class="font-bold text-indigo-300 flex items-center"><svg class="w-5 h-5 text-indigo-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Invite Unlimited Band Members</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>All Band Management Tools</span></li>
                    </ul>
                    <button id="checkout-band" class="btn btn-primary mt-8 w-full font-bold py-3">Start 3-Day Band Trial</button>
                </div>
            </div>
             <div id="manage-billing-section" class="text-center mt-16">
                <p class="text-gray-400 mt-2">You can update your payment method, cancel, or change your plan at any time.</p>
                <button id="manage-billing" class="btn btn-neutral mt-4">Open Customer Portal</button>
            </div>
        </div>

        <!-- VIEW FOR NEW, LOGGED-OUT USERS -->
        <div id="signup-view" class="hidden">
            <div class="text-center mb-12">
                 <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight">
                    Choose Your Plan
                </h1>
                <p class="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
                    Start for free, and upgrade anytime to unlock powerful professional features.
                </p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                <!-- FREE PLAN -->
                <div class="bg-gray-800 p-8 rounded-xl border border-gray-700 flex flex-col">
                    <h2 class="text-3xl font-bold">Free</h2>
                    <p class="text-gray-400 mt-2">Get a feel for the core songwriting tool.</p>
                    <div class="my-6"><span class="text-5xl font-bold">$0</span><span class="text-gray-400">/ forever</span></div>
                    <ul class="space-y-4 text-gray-300 flex-grow">
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Save up to 3 Songs</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Lyrics & Chords Editor</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Print Song PDFs</span></li>
                         <li class="flex items-center text-gray-500"><svg class="w-5 h-5 text-gray-600 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path  stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" ></path></svg><span>Interactive Tab Editors</span></li>
                         <li class="flex items-center text-gray-500"><svg class="w-5 h-5 text-gray-600 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path  stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" ></path></svg><span>Show Builder & Live View</span></li>
                         <li class="flex items-center text-gray-500"><svg class="w-5 h-5 text-gray-600 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path  stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" ></path></svg><span>Voice Memos & Band Tools</span></li>
                    </ul>
                    <button id="signup-free-btn" class="btn btn-secondary mt-8 w-full font-bold py-3">Sign Up for Free</button>
                </div>
                <!-- SOLO PLAN (Signup View) -->
                <div class="bg-gray-800 p-8 rounded-xl border border-gray-700 flex flex-col">
                    <h2 class="text-3xl font-bold">Solo</h2>
                    <p class="text-gray-400 mt-2">The complete toolkit for the individual artist.</p>
                    <div class="my-6"><span class="text-5xl font-bold">$9</span><span class="text-gray-400">/ month</span></div>
                    <p class="text-center text-gray-300 mb-6">or $90 per year (2 months free)</p>
                    <ul class="space-y-4 text-gray-300 flex-grow">
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span><strong>Unlimited</strong> Songs</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Interactive Tab & Drum Editors</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Show Builder & Live View</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Record Voice Memos</span></li>
                    </ul>
                    <button class="checkout-paid-btn btn btn-secondary mt-8 w-full font-bold py-3" data-plan="solo">Start 3-Day Solo Trial</button>
                </div>
                <!-- BAND PLAN (Signup View) -->
                 <div class="bg-gray-800 p-8 rounded-xl border-2 border-indigo-500 flex flex-col">
                    <h2 class="text-3xl font-bold">Band</h2>
                    <p class="text-gray-400 mt-2">Everything for your whole team. No per-user fees.</p>
                     <div class="my-6"><span class="text-5xl font-bold">$19</span><span class="text-gray-400">/ month</span></div>
                    <p class="text-center text-gray-300 mb-6">or $190 per year (2 months free)</p>
                    <ul class="space-y-4 text-gray-300 flex-grow">
                        <li class="font-bold flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Everything in Solo, plus:</span></li>
                        <li class="font-bold text-indigo-300 flex items-center"><svg class="w-5 h-5 text-indigo-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Invite Unlimited Band Members</span></li>
                        <li class="flex items-center"><svg class="w-5 h-5 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>All Band Management Tools</span></li>
                    </ul>
                    <button class="checkout-paid-btn btn btn-primary mt-8 w-full font-bold py-3" data-plan="band">Start 3-Day Band Trial</button>
                </div>
            </div>
             <!-- Signup Form (initially hidden) -->
            <div id="signup-form-container" class="max-w-xl mx-auto bg-gray-900 p-8 rounded-lg mt-12 hidden">
                <h2 id="signup-form-title" class="text-3xl font-bold text-center mb-6 text-white">Create Your Account</h2>
                <form id="signup-form" class="space-y-4">
                    <div class="flex gap-4">
                        <input id="signup-firstname" name="firstName" type="text" required class="form-input" placeholder="First Name">
                        <input id="signup-lastname" name="lastName" type="text" required class="form-input" placeholder="Last Name">
                    </div>
                    <input id="signup-artist-name" name="artistBandName" type="text" required class="form-input" placeholder="Artist/Band Name">
                    <input id="signup-email" name="email" type="email" required class="form-input" placeholder="Email Address">
                    <input id="signup-password" name="password" type="password" required class="form-input" placeholder="Password">
                    <button type="submit" class="btn btn-primary w-full py-3">Create Account & Continue</button>
                </form>
                <p id="signup-error" class="text-red-500 text-sm mt-4 text-center h-5"></p>
                <p class="text-center text-sm text-gray-400 mt-4">Already have an account? <a href="/proanthem_index.html" class="font-medium text-indigo-400 hover:text-indigo-300">Log in</a></p>
            </div>
        </div>
        <div id="status-message" class="mt-8 text-center text-lg"></div>
    </main>
    
    <footer class="text-center py-6 text-gray-500">
        <p>&copy; 2025 ProAnthem. A Spreadsheet Simplicity Product.</p>
    </footer>

    <script type="module" src="/js/auth.js"></script>
    <script type="module">
        import { getUserPayload, performLogin } from './js/auth.js';
        import { signup, createCheckoutSession, createCustomerPortal } from './js/api.js';

        const stripe = Stripe('pk_live_51Ryc5tGbxgsv5aJ6w9YDK0tE0XVnCz1XspXdarf3DYoE7g7YXLut87vm2AUsAjVmHwXTnE6ZXalKohb17u3mA8wa008pR7uPYA');
        const statusMessage = document.getElementById('status-message');
        const signupView = document.getElementById('signup-view');
        const upgradeView = document.getElementById('upgrade-view');
        const signupFormContainer = document.getElementById('signup-form-container');
        const signupForm = document.getElementById('signup-form');
        const signupFormTitle = document.getElementById('signup-form-title');
        
        let planToCheckout = null;

        function initializePage() {
            const user = getUserPayload();
            
            if (!user) {
                signupView.classList.remove('hidden');
                upgradeView.classList.add('hidden');
            } else {
                signupView.classList.add('hidden');
                upgradeView.classList.remove('hidden');
            }
            
            const params = new URLSearchParams(window.location.search);
            if (params.get('checkout_canceled')) {
                statusMessage.textContent = 'Checkout canceled. Your trial has not started. Please choose a plan to continue.';
                statusMessage.classList.add('text-yellow-400');
            }

            signupForm.addEventListener('submit', handleSignup);
            
            document.getElementById('signup-free-btn').addEventListener('click', () => {
                planToCheckout = null; // Free signup
                signupFormTitle.textContent = "Create Your Free Account";
                signupFormContainer.classList.remove('hidden');
                signupFormContainer.scrollIntoView({ behavior: 'smooth' });
            });

            document.querySelectorAll('.checkout-paid-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    planToCheckout = e.target.dataset.plan;
                    signupFormTitle.textContent = "Create Account to Start Trial";
                    signupFormContainer.classList.remove('hidden');
                    signupFormContainer.scrollIntoView({ behavior: 'smooth' });
                });
            });

            document.getElementById('checkout-solo').addEventListener('click', () => startCheckout('solo'));
            document.getElementById('checkout-band').addEventListener('click', () => startCheckout('band'));
            document.getElementById('manage-billing').addEventListener('click', manageBilling);
        }

        async function handleSignup(event) {
            event.preventDefault();
            const signupError = document.getElementById('signup-error');
            signupError.textContent = 'Signing up...';
            const form = event.target;
            const params = new URLSearchParams(window.location.search);
            const inviteToken = params.get('invite_token');

            const payload = {
                firstName: form.querySelector('#signup-firstname').value,
                lastName: form.querySelector('#signup-lastname').value,
                email: form.querySelector('#signup-email').value,
                password: form.querySelector('#signup-password').value,
                artistBandName: inviteToken ? "Invited Member" : form.querySelector('#signup-artist-name').value,
                inviteToken: inviteToken || null,
            };
            
            const pendingSongJSON = localStorage.getItem('pendingSong');
            if (pendingSongJSON) {
                try {
                    payload.pendingSong = JSON.parse(pendingSongJSON);
                } catch (e) { console.error("Could not parse pending song.") }
            }

            try {
                await signup(payload);
                if (pendingSongJSON) localStorage.removeItem('pendingSong');
                const credentials = { email: payload.email, password: payload.password };
                
                await performLogin(credentials);

                // This code will only run after performLogin successfully redirects.
                // In the case of choosing a paid plan from a logged-out state,
                // this logic will be re-evaluated on the reloaded page.
                const user = getUserPayload();
                if (user && planToCheckout) {
                    await startCheckout(planToCheckout);
                }

            } catch(error) {
                signupError.textContent = error.message;
            }
        }
        
        async function startCheckout(plan) {
            try {
                const { id: sessionId } = await createCheckoutSession(plan);
                const { error } = await stripe.redirectToCheckout({ sessionId });
                if (error) {
                    alert(error.message);
                }
            } catch (error) {
                 alert('Error starting checkout: ' + error.message);
            }
        }
        
        async function manageBilling() {
            try {
                const { url } = await createCustomerPortal();
                window.location.href = url;
            } catch(error) {
                 alert('Error opening customer portal: ' + error.message);
            }
        }

        document.addEventListener('DOMContentLoaded', initializePage);
    </script>
</body>
</html>
