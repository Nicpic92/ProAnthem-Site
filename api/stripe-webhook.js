const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Client } = require('pg');

export const config = { api: { bodyParser: false } }; // Critical for raw body verification

export default async function handler(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;
    const chunks = [];
    for await (const chunk of req) { chunks.push(chunk); }
    const body = Buffer.concat(chunks);

    try {
        event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    if (event.type.startsWith('customer.subscription.')) {
        const sub = event.data.object;
        await client.query('UPDATE users SET subscription_status=$1, subscription_id=$2 WHERE stripe_customer_id=$3', [sub.status, sub.id, sub.customer]);
    }
    await client.end();
    return res.status(200).json({ received: true });
}
