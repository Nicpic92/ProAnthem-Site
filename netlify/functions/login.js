// --- START OF FILE netlify/functions/login.js ---

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SOLO_PLAN_PRICE_ID = process.env.STRIPE_SOLO_PRICE_ID;
const BAND_PLAN_PRICE_ID = process.env.STRIPE_BAND_PRICE_ID;
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Email and password are required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const userResult = await client.query(userQuery, [email.toLowerCase()]);

        if (userResult.rows.length === 0) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }
        let user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }
        
        let subStatus = user.subscription_status;
        let userRole = user.role;
        const forceReset = user.password_reset_required || false;

        // --- REBUILT AND IMPROVED LOGIC BLOCK ---
        
        // Priority 1: System admin role always grants access.
        if (user.role === 'admin') {
            subStatus = 'active';
        } 
        // Priority 2: Trust explicit statuses from the database without checking Stripe.
        // This is the key fix for FREE users.
        else if (user.subscription_status === 'free' || user.subscription_status === 'admin_granted') {
            subStatus = user.subscription_status; // Trust the DB value.
        } 
        // Priority 3: Band members inherit their status from their band's admin.
        else if (user.role === 'band_member') {
            const { rows: [bandAdmin] } = await client.query(
                `SELECT subscription_status, stripe_customer_id FROM users WHERE band_id = $1 AND (role = 'band_admin' OR role = 'admin') LIMIT 1`,
                [user.band_id]
            );

            if (bandAdmin && (bandAdmin.subscription_status === 'free' || bandAdmin.subscription_status === 'admin_granted')) {
                // If the admin has a special status, the member inherits it.
                subStatus = bandAdmin.subscription_status;
            } else if (bandAdmin && bandAdmin.stripe_customer_id) {
                // Otherwise, check the admin's Stripe account.
                const subscriptions = await stripe.subscriptions.list({
                    customer: bandAdmin.stripe_customer_id, status: 'all', limit: 1,
                });
                subStatus = subscriptions.data.length > 0 ? subscriptions.data[0].status : 'inactive';
            } else {
                // No admin found or admin has no info.
                subStatus = 'inactive';
            }
        } 
        // Priority 4 (Fallback): If no other rules match, the user MUST be a paying
        // customer (solo or band_admin). We must sync their status with Stripe.
        else {
            if (user.stripe_customer_id) {
                const subscriptions = await stripe.subscriptions.list({
                    customer: user.stripe_customer_id, status: 'all', limit: 1,
                });

                let newStatus = 'inactive'; // Default to inactive if no subscription found
                if (subscriptions.data.length > 0) {
                    newStatus = subscriptions.data[0].status; // e.g., 'active', 'trialing', 'canceled'
                }
                
                // If the status in Stripe is different from our DB, update our DB.
                if (newStatus !== user.subscription_status) {
                    await client.query(
                        'UPDATE users SET subscription_status = $1 WHERE email = $2', 
                        [newStatus, user.email]
                    );
                }
                subStatus = newStatus;
            } else {
                // User has no Stripe ID and no special status. They are inactive.
                subStatus = 'inactive';
            }
        }
        
        const tokenPayload = {
            user: {
                email: user.email, 
                role: userRole, 
                name: user.first_name,
                band_id: user.band_id, 
                subscription_status: subStatus, // Use the final, correct status
                force_reset: forceReset 
            }
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

        if(forceReset) {
            await client.query('UPDATE users SET password_reset_required = FALSE WHERE email = $1', [user.email]);
        }
        
        return { statusCode: 200, body: JSON.stringify({ message: 'Login successful.', token: token }) };
    } catch (error) {
        console.error('Login Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        if(client) {
            await client.end();
        }
    }
};
