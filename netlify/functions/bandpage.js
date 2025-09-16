const { Client } = require('pg');

exports.handler = async (event) => {
    console.log('[1/9] Bandpage function invoked.');
    console.log('Incoming event path:', event.path);

    const slug = event.path.split('/').pop();
    console.log(`[2/9] Parsed slug: "${slug}"`);

    if (!slug) {
        console.log('[ERROR] No slug found. Exiting.');
        return { statusCode: 400, body: JSON.stringify({ message: 'Band slug is required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('[3/9] Attempting to connect to the database...');
        await client.connect();
        console.log('[4/9] Database connection successful.');

        const bandQuery = `
            SELECT 
                band_name, logo_url, hero_image_url, bio,
                contact_public_email, contact_booking_email,
                link_website, link_spotify, link_apple_music,
                link_youtube, link_instagram, link_facebook,
                press_kit_enabled, id
            FROM bands 
            WHERE slug = $1 AND press_kit_enabled = TRUE`;
        
        console.log('[5/9] Executing band query for slug:', slug);
        const { rows: [band] } = await client.query(bandQuery, [slug]);
        console.log('[6/9] Band query finished. Result:', band ? `Found band ID ${band.id}` : 'No band found.');

        if (!band) {
            console.log('[7/9] Band not found or not public. Preparing 404 response.');
            await client.end();
            console.log('DB connection closed. Sending 404.');
            return { statusCode: 404, body: JSON.stringify({ message: 'Band profile not found or is not public.' }) };
        }

        const eventsQuery = `
            SELECT 
                title, event_date, venue_name, details, external_url 
            FROM events 
            WHERE band_id = $1 AND is_public = TRUE 
            ORDER BY event_date ASC`;

        console.log('[8/9] Executing events query for band ID:', band.id);
        const { rows: events } = await client.query(eventsQuery, [band.id]);
        console.log('Events query finished. Found events:', events.length);
        
        const responsePayload = {
            profile: { band_name: band.band_name, logo_url: band.logo_url, hero_image_url: band.hero_image_url, bio: band.bio, contact: { public: band.contact_public_email, booking: band.contact_booking_email, }, links: { website: band.link_website, spotify: band.link_spotify, apple_music: band.link_apple_music, youtube: band.link_youtube, instagram: band.link_instagram, facebook: band.link_facebook } },
            events: events
        };
        
        console.log('[9/9] Preparing successful 200 response.');
        await client.end();
        console.log('DB connection closed. Sending 200.');
        return {
            statusCode: 200,
            body: JSON.stringify(responsePayload)
        };

    } catch (error) {
        console.error('[FATAL ERROR] An error occurred in the handler:', error);
        if (client) {
            await client.end();
            console.log('DB connection closed due to error.');
        }
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } 
};
