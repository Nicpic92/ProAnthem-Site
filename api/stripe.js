// --- START OF FILE netlify/functions/stripe.js ---

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const SOLO_PLAN_PRICE_ID = process.env.STRIPE_SOLO_PRICE_ID;
const BAND_PLAN_PRICE_ID = process.env.STRIPE_BAND_PRICE_ID;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }
    
    let userEmail;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.user.email;
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const resource = path.split('/')[2];
        
        // --- THIS IS THE FIX ---
        // The 'users' table uses 'email' as the primary key, not 'id'.
        // This query is updated to reflect the correct schema.
        const { rows: [user] } = await client.query('SELECT stripe_customer_id, first_name, last_name FROM users WHERE email = $1', [userEmail]);
        
        if (!user) {
            return { statusCode: 404, body: JSON.stringify({ message: 'User not found in database.' }) };
        }

        let stripeCustomerId = user.stripe_customer_id;

        // If the user exists but has no Stripe ID (e.g., they were an invited member),
        // create one for them now.
        if (!stripeCustomerId) {
            console.log(`User ${userEmail} does not have a Stripe customer ID. Creating one now.`);
            const customer = await stripe.customers.create({
                email: userEmail,
                name: `${user.first_name} ${user.last_name}`,
            });
            stripeCustomerId = customer.id;

            // Save the new Stripe customer ID back to our database for future use,
            // using 'email' as the key.
            await client.query('UPDATE users SET stripe_customer_id = $1 WHERE email = $2', [stripeCustomerId, userEmail]);
        }
        
        if (resource === 'create-checkout-session' && event.httpMethod === 'POST') {
            const { plan } = JSON.parse(event.body);
            if (!plan || (plan !== 'solo' && plan !== 'band')) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Invalid plan specified.' }) };
            }
            
            const priceId = plan === 'band' ? BAND_PLAN_PRICE_ID : SOLO_PLAN_PRICE_ID;

            const session = await stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'subscription',
                subscription_data: {
                    trial_period_days: 3
                },
                allow_promotion_codes: true,
                success_url: `${process.env.SITE_URL}/dashboard.html?checkout_success=true`,
                cancel_url: `${process.env.SITE_URL}/pricing.html?checkout_canceled=true`,
            });

            return { statusCode: 200, body: JSON.stringify({ id: session.id }) };
        }
        
        if (resource === 'create-customer-portal' && event.httpMethod === 'POST') {
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: `${process.env.SITE_URL}/dashboard.html`,
            });
            return { statusCode: 200, body: JSON.stringify({ url: portalSession.url }) };
        }

        return { statusCode: 404, body: JSON.stringify({ message: 'Stripe endpoint not found.' }) };
    } catch (error) {
        console.error('Stripe API Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};

// --- END OF FILE netlify/functions/stripe.js ---
