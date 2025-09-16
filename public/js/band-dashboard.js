// --- START OF FILE netlify/functions/band-dashboard.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // Authentication: All dashboard actions require a logged-in user who is part of a band.
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let decodedToken;
    try {
        const token = authHeader.split(' ')[1];
        decodedToken = jwt.verify(token, JWT_SECRET);
        if (!decodedToken.user || !decodedToken.user.band_id) {
            throw new Error("User is not part of a band.");
        }
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: `Invalid or expired token: ${err.message}` }) };
    }

    const { band_id: bandId, role: userRole } = decodedToken.user;

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const resource = path.split('/')[2]; // e.g., 'announcements' or undefined

        // --- Handle Saving Announcements (Admin Only) ---
        if (event.httpMethod === 'PUT' && resource === 'announcements') {
            if (userRole !== 'admin' && userRole !== 'band_admin') {
                return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required to edit announcements.' }) };
            }

            const { content } = JSON.parse(event.body);
            await client.query(
                'UPDATE bands SET announcements = $1 WHERE id = $2',
                [content, bandId]
            );
            return { statusCode: 200, body: JSON.stringify({ message: 'Announcements updated successfully.' }) };
        }

        // --- Handle Fetching Dashboard Data (All Band Members) ---
        if (event.httpMethod === 'GET' && !resource) {
            // Query 1: Get band details including the new announcements field
            const bandQuery = 'SELECT band_name, announcements FROM bands WHERE id = $1';
            const { rows: [bandDetails] } = await client.query(bandQuery, [bandId]);

            if (!bandDetails) {
                return { statusCode: 404, body: JSON.stringify({ message: 'Band not found.' }) };
            }

            // Query 2: Get the next 3 upcoming events
            const eventsQuery = `
                SELECT title, event_date 
                FROM events 
                WHERE band_id = $1 AND event_date >= NOW() 
                ORDER BY event_date ASC 
                LIMIT 3`;
            const { rows: upcomingEvents } = await client.query(eventsQuery, [bandId]);
            
            const responsePayload = {
                band: bandDetails,
                events: upcomingEvents
            };

            return { statusCode: 200, body: JSON.stringify(responsePayload) };
        }
        
        // Fallback for any other requests
        return { statusCode: 404, body: JSON.stringify({ message: 'Dashboard route not found.' }) };

    } catch (error) {
        console.error('API Error in /api/band-dashboard:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
