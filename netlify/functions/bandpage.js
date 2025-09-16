// --- START OF FILE netlify/functions/bandpage.js ---

const { Client } = require('pg');

exports.handler = async (event) => {
    // This is a public endpoint, so no JWT authentication is needed.

    const slug = event.path.split('/').pop();

    if (!slug) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Band slug is required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Fetch the band's public profile information using the slug
        const bandQuery = `
            SELECT 
                band_name, logo_url, hero_image_url, bio,
                contact_public_email, contact_booking_email,
                link_website, link_spotify, link_apple_music,
                link_youtube, link_instagram, link_facebook,
                press_kit_enabled, id
            FROM bands 
            WHERE slug = $1 AND press_kit_enabled = TRUE`;
        
        const { rows: [band] } = await client.query(bandQuery, [slug]);

        if (!band) {
            // --- FIX: Close connection before returning ---
            await client.end();
            return { statusCode: 404, body: JSON.stringify({ message: 'Band profile not found or is not public.' }) };
        }

        // Fetch only the public events for this band, ordered by date
        const eventsQuery = `
            SELECT 
                title, event_date, venue_name, details, external_url 
            FROM events 
            WHERE band_id = $1 AND is_public = TRUE 
            ORDER BY event_date ASC`;

        const { rows: events } = await client.query(eventsQuery, [band.id]);
        
        // Combine the results into a single payload
        const responsePayload = {
            profile: {
                band_name: band.band_name,
                logo_url: band.logo_url,
                hero_image_url: band.hero_image_url,
                bio: band.bio,
                contact: {
                    public: band.contact_public_email,
                    booking: band.contact_booking_email,
                },
                links: {
                    website: band.link_website,
                    spotify: band.link_spotify,
                    apple_music: band.link_apple_music,
                    youtube: band.link_youtube,
                    instagram: band.link_instagram,
                    facebook: band.link_facebook
                }
            },
            events: events
        };
        
        // --- FIX: Close connection before returning ---
        await client.end();
        return {
            statusCode: 200,
            body: JSON.stringify(responsePayload)
        };

    } catch (error) {
        console.error('API Error in /api/bandpage:', error);
        // --- FIX: Ensure connection is closed even on error ---
        if (client) {
            await client.end();
        }
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } 
    // --- FIX: The problematic 'finally' block has been removed ---
};
