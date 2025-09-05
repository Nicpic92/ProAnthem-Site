const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // --- SECURITY: JWT Authentication ---
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let userEmail;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.user.email;
        if (!userEmail) throw new Error("Invalid token payload");
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
    // --- END SECURITY ---

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const setlistId = pathParts.length > 2 && !isNaN(pathParts[2]) ? parseInt(pathParts[2]) : null;
        const resourceType = pathParts.length > 3 ? pathParts[3] : null;
        const songId = pathParts.length > 4 && !isNaN(pathParts[4]) ? parseInt(pathParts[4]) : null;

        if (event.httpMethod === 'GET') {
            if (setlistId && !resourceType) {
                // MODIFIED: Ensure user owns the setlist and the lyric sheets
                const query = `
                    SELECT 
                        s.id, s.name, s.venue, s.event_date, s.notes, s.logo_url
                    FROM setlists s
                    WHERE s.id = $1 AND s.user_email = $2;
                `;
                const setlistResult = await client.query(query, [setlistId, userEmail]);
                if (setlistResult.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Setlist not found or access denied' }) };

                const songsQuery = `
                    SELECT ls.id, ls.title, ls.artist, ls.content
                    FROM setlist_songs ss
                    JOIN lyric_sheets ls ON ss.song_id = ls.id
                    WHERE ss.setlist_id = $1 AND ls.user_email = $2
                    ORDER BY ss.song_order ASC;
                `;
                const songsResult = await client.query(songsQuery, [setlistId, userEmail]);
                
                const setlist = { ...setlistResult.rows[0], songs: songsResult.rows };
                return { statusCode: 200, body: JSON.stringify(setlist) };
            } else {
                // MODIFIED: Get all setlists for the specific user
                const result = await client.query('SELECT id, name FROM setlists WHERE user_email = $1 ORDER BY name ASC', [userEmail]);
                return { statusCode: 200, body: JSON.stringify(result.rows) };
            }
        }
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            if (setlistId && resourceType === 'songs') {
                // MODIFIED: Add verification that user owns setlist and song
                const checkQuery = `
                    SELECT 1 FROM setlists s JOIN lyric_sheets ls ON s.id = $1 AND ls.id = $2
                    WHERE s.user_email = $3 AND ls.user_email = $3
                `;
                const checkResult = await client.query(checkQuery, [setlistId, body.song_id, userEmail]);
                if (checkResult.rows.length === 0) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };

                const query = 'INSERT INTO setlist_songs (setlist_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *';
                const result = await client.query(query, [setlistId, body.song_id]);
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            } else {
                // MODIFIED: Create the setlist with user's email
                const query = 'INSERT INTO setlists (name, user_email) VALUES ($1, $2) RETURNING *';
                const result = await client.query(query, [body.name, userEmail]);
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            }
        }
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            if (setlistId && resourceType === 'songs') {
                // MODIFIED: Add user ownership check before reordering
                const checkQuery = `SELECT 1 FROM setlists WHERE id = $1 AND user_email = $2`;
                const checkResult = await client.query(checkQuery, [setlistId, userEmail]);
                if (checkResult.rows.length === 0) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
                
                const songIds = body.song_ids;
                await client.query('BEGIN');
                for (let i = 0; i < songIds.length; i++) {
                    await client.query('UPDATE setlist_songs SET song_order = $1 WHERE setlist_id = $2 AND song_id = $3', [i, setlistId, songIds[i]]);
                }
                await client.query('COMMIT');
                return { statusCode: 200, body: JSON.stringify({ message: 'Reordered successfully' }) };
            } else if (setlistId) {
                const { name, venue, event_date, notes, logo_url } = body;
                // MODIFIED: Only update if user owns the setlist
                const query = `UPDATE setlists SET name = $1, venue = $2, event_date = $3, notes = $4, logo_url = $5, updated_at = NOW() WHERE id = $6 AND user_email = $7 RETURNING *`;
                const result = await client.query(query, [name, venue, event_date || null, notes, logo_url, setlistId, userEmail]);
                return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
            }
        }
        if (event.httpMethod === 'DELETE') {
            if (setlistId && resourceType === 'songs' && songId) {
                // MODIFIED: Check ownership before deleting song from setlist
                 const checkQuery = `SELECT 1 FROM setlists WHERE id = $1 AND user_email = $2`;
                 const checkResult = await client.query(checkQuery, [setlistId, userEmail]);
                 if (checkResult.rows.length === 0) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
                
                await client.query('DELETE FROM setlist_songs WHERE setlist_id = $1 AND song_id = $2', [setlistId, songId]);
                return { statusCode: 204, body: '' };
            }
        }
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    } catch (error) {
        console.error('API Error in /api/setlists:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error', error: error.message }) };
    } finally {
        if (client) await client.end();
    }
};
