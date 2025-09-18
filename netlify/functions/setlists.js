// --- START OF FILE netlify/functions/setlists.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let userEmail, bandId, subscriptionStatus;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.user.email;
        bandId = decoded.user.band_id;
        subscriptionStatus = decoded.user.subscription_status;
        if (!bandId) throw new Error("Token is missing band_id.");
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: `Invalid or expired token: ${err.message}` }) };
    }
    
    // --- NEW: Block the entire feature for free users ---
    if (subscriptionStatus === 'free') {
        return { statusCode: 403, body: JSON.stringify({ message: 'The Show Builder is a premium feature. Please upgrade to create and manage setlists.' }) };
    }

    const client = new Client({
        // ... rest of the function remains the same ...
    });

    // ...
};
