const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Client } = require('pg');

export const config = { api: { bodyParser: false } }; // Critical for Stripe signatures

async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) { chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk); }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    if (event.type.startsWith('customer.subscription.')) {
        const sub = event.data.object;
        await client.query(
            'UPDATE users SET subscription_status = $1, subscription_id = $2 WHERE stripe_customer_id = $3',
            [sub.status, sub.id, sub.customer]
        );
    }

    await client.end();
    return res.status(200).json({ received: true });
}
