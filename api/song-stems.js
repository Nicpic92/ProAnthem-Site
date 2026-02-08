// --- START OF FILE netlify/functions/song-stems.js ---
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

    const { band_id: bandId, permissions } = decodedToken.user;
    if (!bandId) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: User is not part of a band.' }) };
    }
    const isAuthorizedToWrite = permissions.can_use_stems; // Use the specific permission for stems

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const songId = event.queryStringParameters.song_id ? parseInt(event.queryStringParameters.song_id, 10) : null;
        const stemId = pathParts.length > 2 ? parseInt(pathParts[2], 10) : null;

        if (event.httpMethod === 'GET') {
            if (!songId) return { statusCode: 400, body: JSON.stringify({ message: 'Song ID is required.' })};
            const songCheck = await client.query('SELECT id FROM lyric_sheets WHERE id = $1 AND band_id = $2', [songId, bandId]);
            if (songCheck.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Song not found or access denied.' })};

            const { rows } = await client.query('SELECT * FROM song_stems WHERE song_id = $1 ORDER BY instrument_name', [songId]);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        if (!isAuthorizedToWrite) {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: You do not have permission to modify stems.' }) };
        }

        if (event.httpMethod === 'POST') {
            const { song_id, instrument_name, file_url } = JSON.parse(event.body);
            const songCheck = await client.query('SELECT id FROM lyric_sheets WHERE id = $1 AND band_id = $2', [song_id, bandId]);
            if (songCheck.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Song not found or access denied.' })};
            
            const query = `INSERT INTO song_stems (song_id, band_id, instrument_name, file_url) 
                           VALUES ($1, $2, $3, $4) RETURNING *`;
            const { rows: [newStem] } = await client.query(query, [song_id, bandId, instrument_name, file_url]);
            return { statusCode: 201, body: JSON.stringify(newStem) };
        }

        if (event.httpMethod === 'DELETE' && stemId) {
            const result = await client.query('DELETE FROM song_stems WHERE id = $1 AND band_id = $2', [stemId, bandId]);
            if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Stem not found or access denied.' })};
            return { statusCode: 204, body: '' };
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/song-stems:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};
