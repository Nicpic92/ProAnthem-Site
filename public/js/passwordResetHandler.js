// --- START OF FILE public/js/passwordResetHandler.js ---

import { changePassword } from './api.js';

export function checkForcedReset(user) {
    if (user && user.force_reset) {
        const passwordModal = document.getElementById('password-reset-modal');
        const passwordForm = document.getElementById('password-reset-form');

        if (passwordModal && passwordForm) {
            passwordModal.classList.remove('hidden');
            passwordForm.addEventListener('submit', handlePasswordReset);
        }
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    const errorEl = document.getElementById('password-reset-error');
    const currentPasswordEl = document.getElementById('current-password');
    const newPasswordEl = document.getElementById('new-password');
    const confirmPasswordEl = document.getElementById('confirm-password');

    errorEl.textContent = '';
    const currentPassword = currentPasswordEl.value;
    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    if (newPassword.length < 6) {
        errorEl.textContent = 'New password must be at least 6 characters.';
        return;
    }

    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'New passwords do not match.';
        return;
    }

    try {
        await changePassword({ currentPassword, newPassword });
        
        alert('Password updated successfully! You will now be taken to your dashboard.');
        // --- THIS IS THE FIX ---
        // Redirect to the new main dashboard after successful reset.
        window.location.href = '/dashboard.html';
        
    } catch (error) {
        errorEl.textContent = error.message;
    }
}
// --- END OF FILE public/js/passwordResetHandler.js ---
