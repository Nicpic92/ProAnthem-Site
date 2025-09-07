const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


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
        const userResult = await client.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }
        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }

        // 1. Check Stripe Subscription Status
        let subStatus = 'inactive'; // Default status
        if (user.stripe_customer_id) {
             const subscriptions = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                status: 'all',
                limit: 1,
            });
            if (subscriptions.data.length > 0) {
                // The status could be 'active', 'trialing', 'past_due', 'canceled', etc.
                subStatus = subscriptions.data[0].status; 
            }
        }

        // 2. Update status in our database
        await client.query('UPDATE users SET subscription_status = $1 WHERE email = $2', [subStatus, user.email]);

        // 3. Create a new JWT that includes the up-to-date subscription status
        const tokenPayload = {
            user: {
                email: user.email,
                role: user.role,
                name: user.first_name,
                band_id: user.band_id,
                subscription_status: subStatus 
            }
        };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Login successful.', token: token })
        };
    } catch (error) {
        console.error('Login Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};
