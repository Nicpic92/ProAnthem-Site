// --- START OF FILE netlify/functions/stripe-webhook.js ---

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Client } = require('pg');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// --- MAP YOUR STRIPE PRICE IDs AND DATABASE ROLE IDs ---
const SOLO_PLAN_PRICE_ID = process.env.STRIPE_SOLO_PRICE_ID;
const BAND_PLAN_PRICE_ID = process.env.STRIPE_BAND_PRICE_ID;
const ROLE_ID_BAND_ADMIN = 2;
const ROLE_ID_SOLO = 3;
const ROLE_ID_INACTIVE = 7;

exports.handler = async ({ body, headers }) => {
    const sig = headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

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
        const priceId = subscription.items.data[0]?.price.id;

        let roleIdToSet;

        if (newStatus === 'active' || newStatus === 'trialing') {
            if (priceId === BAND_PLAN_PRICE_ID) {
                roleIdToSet = ROLE_ID_BAND_ADMIN;
            } else if (priceId === SOLO_PLAN_PRICE_ID) {
                roleIdToSet = ROLE_ID_SOLO;
            } else {
                console.warn(`Unrecognized price ID ${priceId} for active subscription. Defaulting to inactive.`);
                roleIdToSet = ROLE_ID_INACTIVE; 
            }
        } else {
            // If subscription is canceled, past_due, etc., downgrade them to the inactive role.
            roleIdToSet = ROLE_ID_INACTIVE;
        }
        
        console.log(`HANDLING STRIPE EVENT: Type=${event.type}, Customer=${stripeCustomerId}, New Status=${newStatus}, Setting Role ID=${roleIdToSet}`);

        const result = await client.query(
            `UPDATE users SET subscription_status = $1, subscription_id = $2, role_id = $3 WHERE stripe_customer_id = $4`, 
            [newStatus, subscriptionId, roleIdToSet, stripeCustomerId]
        );
        
        if (result.rowCount > 0) {
            console.log(`SUCCESS: User status and role updated for customer ${stripeCustomerId}.`);
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
