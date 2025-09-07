const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let userEmail, bandId;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.user.email;
        bandId = decoded.user.band_id;
        if (!bandId) throw new Error("Token is missing band_id.");
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pathParts = event.path.split('/').filter(Boolean);
        const setlistId = pathParts.length > 2 && !isNaN(pathParts[2]) ? parseInt(pathParts[2]) : null;
        const resourceType = pathParts.length > 3 ? pathParts[3] : null;
        const songId = pathParts.length > 4 && !isNaN(pathParts[4]) ? parseInt(pathParts[4]) : null;

        let response;

        if (event.httpMethod === 'GET') {
            if (setlistId && !resourceType) {
                const query = `SELECT id, name, venue, event_date, notes, logo_url FROM setlists WHERE id = $1 AND band_id = $2;`;
                const setlistResult = await client.query(query, [setlistId, bandId]);
                if (setlistResult.rows.length === 0) {
                    response = { statusCode: 404, body: JSON.stringify({ message: 'Setlist not found or access denied' }) };
                } else {
                    const songsQuery = `
                        SELECT ls.id, ls.title, ls.artist, ls.song_blocks 
                        FROM setlist_songs ss
                        JOIN lyric_sheets ls ON ss.song_id = ls.id
                        WHERE ss.setlist_id = $1 AND ls.band_id = $2
                        ORDER BY ss.song_order ASC;
                    `;
                    const songsResult = await client.query(songsQuery, [setlistId, bandId]);
                    const setlist = { ...setlistResult.rows[0], songs: songsResult.rows };
                    response = { statusCode: 200, body: JSON.stringify(setlist) };
                }
            } else {
                const result = await client.query('SELECT id, name FROM setlists WHERE band_id = $1 ORDER BY name ASC', [bandId]);
                response = { statusCode: 200, body: JSON.stringify(result.rows) };
            }
        } else if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            if (setlistId && resourceType === 'songs') {
                const checkQuery = `SELECT 1 FROM setlists s JOIN lyric_sheets ls ON s.id = $1 AND ls.id = $2 WHERE s.band_id = $3 AND ls.band_id = $3`;
                const checkResult = await client.query(checkQuery, [setlistId, body.song_id, bandId]);
                if (checkResult.rows.length === 0) {
                    response = { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Setlist or song does not belong to the band.' }) };
                } else {
                    const maxOrderQuery = 'SELECT MAX(song_order) as max_order FROM setlist_songs WHERE setlist_id = $1';
                    const maxOrderResult = await client.query(maxOrderQuery, [setlistId]);
                    const nextOrder = (maxOrderResult.rows[0].max_order === null) ? 0 : maxOrderResult.rows[0].max_order + 1;
                    const insertQuery = 'INSERT INTO setlist_songs (setlist_id, song_id, song_order) VALUES ($1, $2, $3) RETURNING *';
                    const result = await client.query(insertQuery, [setlistId, body.song_id, nextOrder]);
                    response = { statusCode: 201, body: JSON.stringify(result.rows[0]) };
                }
            } else {
                const query = 'INSERT INTO setlists (name, user_email, band_id) VALUES ($1, $2, $3) RETURNING *';
                const result = await client.query(query, [body.name, userEmail, bandId]);
                response = { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            }
        } else if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            if (setlistId && resourceType === 'songs') {
                const checkQuery = `SELECT 1 FROM setlists WHERE id = $1 AND band_id = $2`;
                const checkResult = await client.query(checkQuery, [setlistId, bandId]);
                if (checkResult.rows.length === 0) {
                    response = { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
                } else {
                    const songIds = body.song_ids;
                    await client.query('DELETE FROM setlist_songs WHERE setlist_id = $1', [setlistId]);
                    for (let i = 0; i < songIds.length; i++) {
                        await client.query('INSERT INTO setlist_songs (setlist_id, song_id, song_order) VALUES ($1, $2, $3)', [setlistId, songIds[i], i]);
                    }
                    response = { statusCode: 200, body: JSON.stringify({ message: 'Reordered successfully' }) };
                }
            } else if (setlistId) {
                const { name, venue, event_date, notes, logo_url } = body;
                const query = `UPDATE setlists SET name = $1, venue = $2, event_date = $3, notes = $4, logo_url = $5, updated_at = NOW() WHERE id = $6 AND band_id = $7 RETURNING *`;
                const result = await client.query(query, [name, venue, event_date || null, notes, logo_url, setlistId, bandId]);
                if (result.rowCount === 0) {
                    response = { statusCode: 404, body: JSON.stringify({ message: 'Setlist not found or access denied.' })};
                } else {
                    response = { statusCode: 200, body: JSON.stringify(result.rows[0]) };
                }
            }
        } else if (event.httpMethod === 'DELETE') {
            if (setlistId && !resourceType) {
                 await client.query('DELETE FROM setlist_songs WHERE setlist_id = (SELECT id FROM setlists WHERE id = $1 AND band_id = $2)', [setlistId, bandId]);
                 await client.query('DELETE FROM setlists WHERE id = $1 AND band_id = $2', [setlistId, bandId]);
                 response = { statusCode: 204, body: '' };
            } else if (setlistId && resourceType === 'songs' && songId) {
                 const checkQuery = `SELECT 1 FROM setlists WHERE id = $1 AND band_id = $2`;
                 const checkResult = await client.query(checkQuery, [setlistId, bandId]);
                 if (checkResult.rows.length === 0) {
                     response = { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
                 } else {
                    await client.query('DELETE FROM setlist_songs WHERE setlist_id = $1 AND song_id = $2', [setlistId, songId]);
                    response = { statusCode: 204, body: '' };
                 }
            }
        } else {
            response = { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
        }
        
        await client.query('COMMIT');
        return response;

    } catch (error) {
        console.error('API Error in /api/setlists:', error);
        await client.query('ROLLBACK').catch(console.error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error', error: error.message }) };
    } finally {
        client.release();
    }
};
