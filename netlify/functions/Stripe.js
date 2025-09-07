const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const SOLO_PLAN_PRICE_ID = process.env.STRIPE_SOLO_PRICE_ID;
const BAND_PLAN_PRICE_ID = process.env.STRIPE_BAND_PRICE_ID;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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

    const client = await pool.connect();
    try {
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const resource = path.split('/')[2];
        
        const { rows: [user] } = await client.query('SELECT stripe_customer_id FROM users WHERE email = $1', [userEmail]);
        if (!user || !user.stripe_customer_id) {
            return { statusCode: 404, body: JSON.stringify({ message: 'User or Stripe customer not found' }) };
        }
        
        if (resource === 'create-checkout-session' && event.httpMethod === 'POST') {
            const { plan } = JSON.parse(event.body);
            if (!plan || (plan !== 'solo' && plan !== 'band')) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Invalid plan specified.' }) };
            }
            
            const priceId = plan === 'band' ? BAND_PLAN_PRICE_ID : SOLO_PLAN_PRICE_ID;

            const session = await stripe.checkout.sessions.create({
                customer: user.stripe_customer_id,
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'subscription',
                subscription_data: {
                    trial_period_days: 3
                },
                allow_promotion_codes: true,
                success_url: `${process.env.SITE_URL}/ProjectAnthem.html?checkout_success=true`,
                cancel_url: `${process.env.SITE_URL}/pricing.html?checkout_canceled=true`,
            });

            return { statusCode: 200, body: JSON.stringify({ id: session.id }) };
        }
        
        if (resource === 'create-customer-portal' && event.httpMethod === 'POST') {
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: user.stripe_customer_id,
                return_url: `${process.env.SITE_URL}/ProjectAnthem.html`,
            });
            return { statusCode: 200, body: JSON.stringify({ url: portalSession.url }) };
        }

        return { statusCode: 404, body: JSON.stringify({ message: 'Stripe endpoint not found.' }) };
    } catch (error) {
        console.error('Stripe API Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        client.release();
    }
};
