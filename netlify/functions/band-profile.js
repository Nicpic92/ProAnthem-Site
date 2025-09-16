const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // ... authentication logic ...
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }
    let decodedToken;
    try {
        const token = authHeader.split(' ')[1];
        decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
    const { band_id: bandId, role: userRole } = decodedToken.user;
    if (!bandId) {
        return { statusCode: 400, body: JSON.stringify({ message: 'User is not associated with a band.' }) };
    }
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const pathParts = path.split('/').filter(Boolean);
        const resource = pathParts[1];
        const resourceId = pathParts[2] ? parseInt(pathParts[2], 10) : null;
        const isAuthorized = userRole === 'admin' || userRole === 'band_admin';

        if (resource !== 'events') {
            if (event.httpMethod === 'GET') {
                const { rows: [profile] } = await client.query('SELECT * FROM bands WHERE id = $1', [bandId]);
                if (!profile) return { statusCode: 404, body: JSON.stringify({ message: 'Band profile not found.' })};
                return { statusCode: 200, body: JSON.stringify(profile) };
            }

            if (event.httpMethod === 'PUT' && isAuthorized) {
                const p = JSON.parse(event.body);
                
                // --- THIS IS THE FIX ---
                // 1. Force the slug to be lowercase before saving.
                const slugToSave = p.slug ? p.slug.toLowerCase() : null;

                // 2. Correctly handle the boolean value. HTML forms send "on" or nothing.
                const pressKitEnabled = p.press_kit_enabled === 'on' || p.press_kit_enabled === true;

                if (slugToSave) {
                    // Use the lowercase version for the uniqueness check.
                    const { rows: [existing] } = await client.query('SELECT id FROM bands WHERE slug = $1 AND id != $2', [slugToSave, bandId]);
                    if (existing) return { statusCode: 409, body: JSON.stringify({ message: 'That custom URL (slug) is already taken.' })};
                }

                const query = `
                    UPDATE bands SET
                        slug = $1, logo_url = $2, hero_image_url = $3, bio = $4,
                        contact_public_email = $5, contact_booking_email = $6,
                        link_website = $7, link_spotify = $8, link_apple_music = $9,
                        link_youtube = $10, link_instagram = $11, link_facebook = $12,
                        press_kit_enabled = $13, band_name = $14
                    WHERE id = $15 RETURNING *`;
                const values = [
                    slugToSave, p.logo_url, p.hero_image_url, p.bio,
                    p.contact_public_email, p.contact_booking_email,
                    p.link_website, p.link_spotify, p.link_apple_music,
                    p.link_youtube, p.link_instagram, p.link_facebook,
                    pressKitEnabled, // Use the corrected boolean value
                    p.band_name, bandId
                ];
                const { rows: [updatedProfile] } = await client.query(query, values);
                return { statusCode: 200, body: JSON.stringify(updatedProfile) };
            }
        }
        
        // ... Events logic remains correct ...
        if (resource === 'events') {
            // ...
            if (event.httpMethod === 'GET') {
                const { rows } = await client.query('SELECT * FROM events WHERE band_id = $1 ORDER BY event_date ASC', [bandId]);
                return { statusCode: 200, body: JSON.stringify(rows) };
            }

            if (event.httpMethod === 'POST' && isAuthorized) {
                const e = JSON.parse(event.body);
                const query = `INSERT INTO events (band_id, title, event_date, venue_name, details, is_public, external_url, setlist_id)
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
                const values = [bandId, e.title, e.event_date, e.venue_name, e.details, e.is_public, e.external_url, e.setlist_id];
                const { rows: [newEvent] } = await client.query(query, values);
                return { statusCode: 201, body: JSON.stringify(newEvent) };
            }

            if (event.httpMethod === 'PUT' && resourceId && isAuthorized) {
                const e = JSON.parse(event.body);
                const query = `UPDATE events SET 
                                title = $1, event_date = $2, venue_name = $3, details = $4, 
                                is_public = $5, external_url = $6, setlist_id = $7
                               WHERE id = $8 AND band_id = $9 RETURNING *`;
                const values = [e.title, e.event_date, e.venue_name, e.details, e.is_public, e.external_url, e.setlist_id, resourceId, bandId];
                const { rows: [updatedEvent] } = await client.query(query, values);
                if (!updatedEvent) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
                return { statusCode: 200, body: JSON.stringify(updatedEvent) };
            }

            if (event.httpMethod === 'DELETE' && resourceId && isAuthorized) {
                const result = await client.query('DELETE FROM events WHERE id = $1 AND band_id = $2', [resourceId, bandId]);
                if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
                return { statusCode: 204, body: '' };
            }
        }
        
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden or action not found.' }) };

    } catch (error) {
        console.error('API Error in /api/band-profile:', error);
        return { sta
