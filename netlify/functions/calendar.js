// --- START OF FILE netlify/functions/calendar.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
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
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: User is not part of a band.' }) };
    }
    const isAuthorizedToWrite = userRole === 'admin' || userRole === 'band_admin';

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const eventId = pathParts.length > 2 ? parseInt(pathParts[2], 10) : null;

        if (event.httpMethod === 'GET') {
            const { rows } = await client.query('SELECT * FROM events WHERE band_id = $1 ORDER BY event_date DESC', [bandId]);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        if (!isAuthorizedToWrite) {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required for this action.' }) };
        }

        if (event.httpMethod === 'POST') {
            const { title, event_date, venue_name, details, is_public, external_url } = JSON.parse(event.body);
            const query = `INSERT INTO events (band_id, title, event_date, venue_name, details, is_public, external_url) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
            const { rows: [newEvent] } = await client.query(query, [bandId, title, event_date, venue_name, details, is_public, external_url]);
            return { statusCode: 201, body: JSON.stringify(newEvent) };
        }

        if (event.httpMethod === 'PUT' && eventId) {
            const { title, event_date, venue_name, details, is_public, external_url } = JSON.parse(event.body);
            const query = `UPDATE events SET title=$1, event_date=$2, venue_name=$3, details=$4, is_public=$5, external_url=$6 
                           WHERE id=$7 AND band_id=$8 RETURNING *`;
            const { rows: [updated] } = await client.query(query, [title, event_date, venue_name, details, is_public, external_url, eventId, bandId]);
            if (!updated) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
            return { statusCode: 200, body: JSON.stringify(updated) };
        }

        if (event.httpMethod === 'DELETE' && eventId) {
            const result = await client.query('DELETE FROM events WHERE id=$1 AND band_id=$2', [eventId, bandId]);
             if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
            return { statusCode: 204, body: '' };
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/calendar:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};

// --- END OF FILE netlify/functions/calendar.js ---
