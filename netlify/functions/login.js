// In netlify/functions/login.js

// ... (user is found, password matches) ...

const specialRoles = ['admin', 'band_admin', 'band_member'];
const specialStatuses = ['admin_granted', 'trialing'];

if (specialRoles.includes(userRole) || specialStatuses.includes(subStatus)) {
    // A 'band_member' ENTERS this block.
    // The code does nothing and proceeds to generate a token.
    // THIS PART IS CORRECT.
} else {
    // A PAYING 'solo' or 'band_admin' enters this block.
    // THIS LOGIC IS FLAWED, BUT NOT THE CAUSE OF THE CURRENT ERROR.
}

// ... token generation ...
