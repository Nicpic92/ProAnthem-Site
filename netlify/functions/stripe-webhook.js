const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Client } = require('pg');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async ({ body, headers }) => {
    const sig = headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    // --- Only handle the events we care about ---
    if (!event.type.startsWith('customer.subscription.')) {
        console.log(`Ignoring irrelevant Stripe event type: ${event.type}`);
        return { statusCode: 200, body: JSON.stringify({ received: true, message: "Event ignored." }) };
    }
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const newStatus = subscription.status; // e.g., 'trialing', 'active', 'canceled'
        const subscriptionId = subscription.id;
        
        console.log(`HANDLING STRIPE EVENT: Type=${event.type}, Customer=${stripeCustomerId}, New Status=${newStatus}`);

        const result = await client.query(
            `UPDATE users SET subscription_status = $1, subscription_id = $2 WHERE stripe_customer_id = $3`, 
            [newStatus, subscriptionId, stripeCustomerId]
        );
        
        if (result.rowCount > 0) {
            console.log(`SUCCESS: User status updated for customer ${stripeCustomerId}.`);
        } else {
            console.warn(`WARNING: No user found with stripe_customer_id ${stripeCustomerId}. Update failed.`);
        }

    } catch (error) {
        console.error('Error handling webhook:', error);
        return { statusCode: 500, body: `Webhook Handler Error: ${error.message}` };
    } finally {
        await client.end();
    }
    
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
