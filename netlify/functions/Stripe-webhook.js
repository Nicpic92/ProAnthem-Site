const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async ({ body, headers }) => {
    const sig = headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    const client = await pool.connect();

    try {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const newStatus = subscription.status; // 'active', 'trialing', 'canceled', etc.
        const subscriptionId = subscription.id;
        
        console.log(`Received Stripe event: ${event.type} for customer ${stripeCustomerId} with status ${newStatus}`);

        await client.query(
            `UPDATE users SET subscription_status = $1, subscription_id = $2 WHERE stripe_customer_id = $3`, 
            [newStatus, subscriptionId, stripeCustomerId]
        );

    } catch (error) {
        console.error('Error handling webhook:', error);
        return { statusCode: 500, body: `Webhook Handler Error: ${error.message}` };
    } finally {
        client.release();
    }
    
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
