// --- START OF FILE public/js/passwordResetHandler.js ---

import { changePassword } from './api.js';

/**
 * Checks if the user is required to reset their password and displays the modal if so.
 * @param {object | null} user The user payload from the JWT.
 */
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

/**
 * Handles the submission of the password reset form.
 * @param {Event} event The form submission event.
 */
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
        
        alert('Password updated successfully! You can now use the tool.');
        document.getElementById('password-reset-modal').classList.add('hidden');
        // The page is now effectively un-blocked.
        
    } catch (error) {
        errorEl.textContent = error.message;
    }
}
