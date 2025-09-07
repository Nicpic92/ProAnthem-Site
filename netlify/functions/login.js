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

        // --- FIX: Reverted specialStatuses array and corrected the logic ---
        const specialRoles = ['admin', 'band_member']; // Band admins are determined by Stripe, not a special role here
        const specialStatuses = ['admin_granted'];

        if (specialRoles.includes(userRole) || specialStatuses.includes(subStatus)) {
            // This is a special user (Super Admin, Invited Member, VIP), trust our database and do not check Stripe.
        } else {
            // This is a paying customer (or potential one), so we will ALWAYS sync their status with Stripe on login.
            // This is now the single source of truth for subscription status.
            if (user.stripe_customer_id) {
                const subscriptions = await stripe.subscriptions.list({
                    customer: user.stripe_customer_id,
                    status: 'all', 
                    limit: 1,
                });

                let newStatus = 'inactive';
                let newPlan = null;
                // --- FIX: Default to 'solo' role, let Stripe upgrade them to 'band_admin' if they have a band plan ---
                let newRole = 'solo'; 

                if (subscriptions.data.length > 0) {
                    const sub = subscriptions.data[0];
                    newStatus = sub.status; // This will be 'trialing', 'active', 'canceled', etc.
                    const priceId = sub.items.data[0].price.id;

                    if (priceId === BAND_PLAN_PRICE_ID) {
                        newPlan = 'band';
                        newRole = 'band_admin'; // Upgrade user to band_admin
                    } else if (priceId === SOLO_PLAN_PRICE_ID) {
                        newPlan = 'solo';
                        newRole = 'solo'; // Keep user as solo
                    }
                }
                
                // Only update the database if the status or role has actually changed.
                if (newStatus !== subStatus || newRole !== userRole) {
                    await client.query(
                        'UPDATE users SET subscription_status = $1, subscription_plan = $2, role = $3 WHERE email = $4', 
                        [newStatus, newPlan, newRole, user.email]
                    );
                }

                // Use the freshly synced data for the token
                subStatus = newStatus;
                userRole = newRole;
            } else {
                // If they have no stripe ID for some reason, they are inactive.
                subStatus = 'inactive';
            }
        }
        
        const tokenPayload = {
            user: {
                email: user.email, role: userRole, name: user.first_name,
                band_id: user.band_id, subscription_status: subStatus,
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
        await client.end();
    }
};
