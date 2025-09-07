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

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        // Handle the event
        switch (event.type) {
            case 'customer.subscription.deleted':
            case 'customer.subscription.updated':
                // Subscription was canceled, or trial ended without payment.
                // Downgrade the user to a 'free' (inactive) role.
                if (subscription.status !== 'active' && subscription.status !== 'trialing') {
                    await client.query(`UPDATE users SET role = 'free' WHERE stripe_customer_id = $1`, [stripeCustomerId]);
                    console.log(`Deactivated subscription for customer: ${stripeCustomerId}`);
                }
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (error) {
        console.error('Error handling webhook:', error);
        return { statusCode: 500, body: `Webhook Handler Error: ${error.message}` };
    } finally {
        await client.end();
    }
    
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
