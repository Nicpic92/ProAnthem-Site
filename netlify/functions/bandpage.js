const { Client } = require('pg');

exports.handler = async (event) => {
    const slug = event.queryStringParameters.slug;

    if (!slug) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Band slug is required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const bandQuery = `
            SELECT 
                band_name, logo_url, hero_image_url, bio,
                contact_public_email, contact_booking_email,
                link_website, link_spotify, link_apple_music,
                link_youtube, link_instagram, link_facebook,
                press_kit_enabled, id,
                photo_gallery
            FROM bands 
            WHERE LOWER(slug) = LOWER($1) AND press_kit_enabled = TRUE`;
        
        const { rows: [band] } = await client.query(bandQuery, [slug]);

        if (!band) {
            await client.end();
            return { statusCode: 404, body: JSON.stringify({ message: 'Band profile not found or is not public.' }) };
        }

        const eventsQuery = `
            SELECT 
                title, event_date, venue_name, details, external_url 
            FROM events 
            WHERE band_id = $1 AND is_public = TRUE 
            ORDER BY event_date ASC`;

        const { rows: events } = await client.query(eventsQuery, [band.id]);
        
        const responsePayload = {
            profile: {
                band_name: band.band_name,
                logo_url: band.logo_url,
                hero_image_url: band.hero_image_url,
                bio: band.bio,
                contact: { public: band.contact_public_email, booking: band.contact_booking_email },
                links: { website: band.link_website, spotify: band.link_spotify, apple_music: band.link_apple_music, youtube: band.link_youtube, instagram: band.link_instagram, facebook: band.link_facebook },
                photo_gallery: band.photo_gallery || []
            },
            events: events
        };
        
        await client.end();
        return {
            statusCode: 200,
            body: JSON.stringify(responsePayload)
        };

    } catch (error) {
        console.error('API Error in /api/bandpage:', error);
        if (client) {
            await client.end();
        }
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } 
};
