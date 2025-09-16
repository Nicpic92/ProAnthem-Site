// --- START OF FILE netlify/functions/band-profile.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // Authentication
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
    const isAuthorized = userRole === 'admin' || userRole === 'band_admin';

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const pathParts = path.split('/').filter(Boolean);
        const resource = pathParts[1];
        const resourceId = pathParts.length > 2 ? parseInt(pathParts[2], 10) : null;

        // --- Main Profile Route (/band-profile) ---
        if (!resource) {
            if (event.httpMethod === 'GET') {
                const query = 'SELECT band_name, slug, bio, link_website, link_spotify, link_apple_music, link_youtube, link_instagram, link_facebook, photo_gallery, press_kit_enabled FROM bands WHERE id = $1';
                const { rows: [profile] } = await client.query(query, [bandId]);
                if (!profile) return { statusCode: 404, body: JSON.stringify({ message: 'Profile not found.' }) };
                return { statusCode: 200, body: JSON.stringify(profile) };
            }
            if (event.httpMethod === 'PUT' && isAuthorized) {
                const p = JSON.parse(event.body);
                // Ensure photo_gallery is an array of strings
                const photoGallery = Array.isArray(p.photo_gallery) ? p.photo_gallery.filter(url => typeof url === 'string' && url.trim() !== '') : [];

                const query = `UPDATE bands SET 
                                band_name = $1, slug = $2, bio = $3, link_website = $4, link_spotify = $5, 
                                link_apple_music = $6, link_youtube = $7, link_instagram = $8, 
                                link_facebook = $9, photo_gallery = $10, press_kit_enabled = $11
                               WHERE id = $12 RETURNING *`;
                const values = [p.band_name, p.slug, p.bio, p.link_website, p.link_spotify, p.link_apple_music, p.link_youtube, p.link_instagram, p.link_facebook, JSON.stringify(photoGallery), p.press_kit_enabled, bandId];
                const { rows: [updatedProfile] } = await client.query(query, values);
                return { statusCode: 200, body: JSON.stringify(updatedProfile) };
            }
        }

        // --- Events Route (/band-profile/events) ---
        if (resource === 'events') {
            if (event.httpMethod === 'GET') {
                const query = `
                    SELECT e.*, s.name as setlist_name 
                    FROM events e
                    LEFT JOIN setlists s ON e.setlist_id = s.id
                    WHERE e.band_id = $1 
                    ORDER BY e.event_date ASC`;
                const { rows } = await client.query(query, [bandId]);
                // FIX: Removed premature client.end()
                return { statusCode: 200, body: JSON.stringify(rows) };
            }

            if (event.httpMethod === 'POST' && isAuthorized) {
                const e = JSON.parse(event.body);
                await client.query('BEGIN');
                const eventQuery = `INSERT INTO events (band_id, title, event_date, venue_name, details, is_public, external_url)
                               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
                const eventValues = [bandId, e.title, e.event_date, e.venue_name, e.details, e.is_public, e.external_url];
                const { rows: [newEvent] } = await client.query(eventQuery, eventValues);
                
                if (e.setlist_id) {
                    await client.query('UPDATE events SET setlist_id = NULL WHERE setlist_id = $1 AND band_id = $2', [e.setlist_id, bandId]);
                    await client.query('UPDATE setlists SET event_id = $1 WHERE id = $2 AND band_id = $3', [newEvent.id, e.setlist_id, bandId]);
                }
                await client.query('COMMIT');
                // FIX: Removed premature client.end()
                return { statusCode: 201, body: JSON.stringify(newEvent) };
            }

            if (event.httpMethod === 'PUT' && resourceId && isAuthorized) {
                const e = JSON.parse(event.body);
                await client.query('BEGIN');
                const eventQuery = `UPDATE events SET 
                                title = $1, event_date = $2, venue_name = $3, details = $4, 
                                is_public = $5, external_url = $6
                               WHERE id = $7 AND band_id = $8 RETURNING *`;
                const eventValues = [e.title, e.event_date, e.venue_name, e.details, e.is_public, e.external_url, resourceId, bandId];
                const { rows: [updatedEvent] } = await client.query(eventQuery, eventValues);

                // If a setlist ID is provided, manage the link
                if (e.setlist_id) {
                    // Unlink any other event that might be using this setlist
                    await client.query('UPDATE setlists SET event_id = NULL WHERE id = $1 AND band_id = $2', [e.setlist_id, bandId]);
                    // Link this setlist to this event
                    await client.query('UPDATE setlists SET event_id = $1 WHERE id = $2 AND band_id = $3', [resourceId, e.setlist_id, bandId]);
                } else {
                    // If no setlist_id is provided, ensure this event is not linked to any setlist
                    await client.query('UPDATE setlists SET event_id = NULL WHERE event_id = $1 AND band_id = $2', [resourceId, bandId]);
                }
                
                await client.query('COMMIT');
                if (!updatedEvent) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
                // FIX: Removed premature client.end()
                return { statusCode: 200, body: JSON.stringify(updatedEvent) };
            }
            
            if (event.httpMethod === 'DELETE' && resourceId && isAuthorized) {
                // Also unlink any setlist linked to this event
                await client.query('UPDATE setlists SET event_id = NULL WHERE event_id = $1 AND band_id = $2', [resourceId, bandId]);
                const result = await client.query('DELETE FROM events WHERE id = $1 AND band_id = $2', [resourceId, bandId]);
                if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
                return { statusCode: 204, body: '' };
            }
        }

        return { statusCode: 404, body: JSON.stringify({ message: 'Band profile route not found.' }) };
    } catch (error) {
        console.error('API Error in /api/band-profile:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        // This single block now handles closing the connection for ALL cases.
        if (client) await client.end();
    }
};
