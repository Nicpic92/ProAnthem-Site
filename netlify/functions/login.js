// This is a paying customer, verify their status with Stripe
if (user.stripe_customer_id) {
    const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'all', limit: 1,
    });

    let newStatus = 'inactive';
    let newPlan = null;
    let newRole = 'solo'; // <-- PROBLEM #1: It defaults to 'solo'

    if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        newStatus = sub.status;
        const priceId = sub.items.data[0].price.id;

        if (priceId === BAND_PLAN_PRICE_ID) {
            newPlan = 'band';
            newRole = 'band_admin'; // It only sets the role for the band plan
        } else if (priceId === SOLO_PLAN_PRICE_ID) {
            newPlan = 'solo';
            newRole = 'solo';
        }
    }
    
    // PROBLEM #2: This check is too strict.
    if (newStatus !== subStatus || newRole !== userRole) {
        await client.query(
            'UPDATE users SET subscription_status = $1, subscription_plan = $2, role = $3 WHERE email = $4', 
            [newStatus, newPlan, newRole, user.email]
        );
    }
    subStatus = newStatus;
    userRole = newRole; // The user's role is potentially changed
}
