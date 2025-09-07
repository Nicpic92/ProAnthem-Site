const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const SOLO_PLAN_PRICE_ID = process.env.STRIPE_SOLO_PRICE_ID; // e.g., price_123...
const BAND_PLAN_PRICE_ID = process.env.STRIPE_BAND_PRICE_ID; // e.g., price_456...

exports.handler = async (event) => {
    // 1. Authenticate the user with JWT
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
        const resource = path.split('/')[2]; // e.g., 'stripe/create-customer-portal'
        
        // Find user and their Stripe Customer ID from your database
        const userQuery = await client.query('SELECT stripe_customer_id, role FROM users WHERE email = $1', [userEmail]);
        if (userQuery.rows.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
        }
        const { stripe_customer_id, role } = userQuery.rows[0];

        // 2. Route the request based on the path
        if (resource === 'create-checkout-session' && event.httpMethod === 'POST') {
            const { plan } = JSON.parse(event.body);
            const priceId = plan === 'band' ? BAND_PLAN_PRICE_ID : SOLO_PLAN_PRICE_ID;

            const session = await stripe.checkout.sessions.create({
                customer: stripe_customer_id,
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'subscription',
                subscription_data: {
                    trial_period_days: 3
                },
                allow_promotion_codes: true,
                success_url: `${process.env.SITE_URL}/ProjectAnthem.html?success=true`,
                cancel_url: `${process.env.SITE_URL}/pricing.html?canceled=true`,
            });

            return { statusCode: 200, body: JSON.stringify({ id: session.id }) };
        }
        
        if (resource === 'create-customer-portal' && event.httpMethod === 'POST') {
             if (!stripe_customer_id) {
                return { statusCode: 400, body: JSON.stringify({ message: 'No Stripe customer ID found for this user.' })};
            }
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: stripe_customer_id,
                return_url: `${process.env.SITE_URL}/ProjectAnthem.html`,
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
