const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

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
        if (!userEmail || !bandId) throw new Error("Invalid token payload for ProAnthem");
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const rawId = pathParts.length > 2 ? pathParts[2] : null;

        const id = rawId ? parseInt(rawId.trim(), 10) : null;
        if (rawId && isNaN(id)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid ID format.' }) };
        }

        if (id) {
            if (event.httpMethod === 'GET') {
                const result = await client.query('SELECT * FROM lyric_sheets WHERE id = $1 AND band_id = $2', [id, bandId]);
                if (result.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Sheet not found or access denied' }) };
                return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
            }
            if (event.httpMethod === 'PUT') {
                const { title, artist, content, audio_url, tab_content } = JSON.parse(event.body);
                // Ensure tab_content is a valid JSON or null
                const tabContentJson = typeof tab_content === 'object' ? JSON.stringify(tab_content) : null;
                const query = 'UPDATE lyric_sheets SET title = $1, artist = $2, content = $3, audio_url = $4, tab_content = $5, updated_at = NOW() WHERE id = $6 AND band_id = $7 RETURNING *';
                const result = await client.query(query, [title, artist, content, audio_url, tabContentJson, id, bandId]);
                return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
            }
            if (event.httpMethod === 'DELETE') {
                await client.query('DELETE FROM lyric_sheets WHERE id = $1 AND band_id = $2', [id, bandId]);
                return { statusCode: 204, body: '' };
            }
        } else {
            if (event.httpMethod === 'GET') {
                const result = await client.query('SELECT id, title, artist, updated_at FROM lyric_sheets WHERE band_id = $1 ORDER BY updated_at DESC', [bandId]);
                return { statusCode: 200, body: JSON.stringify(result.rows) };
            }
            if (event.httpMethod === 'POST') {
                const { title, artist, content, tab_content } = JSON.parse(event.body);
                const tabContentJson = typeof tab_content === 'object' ? JSON.stringify(tab_content) : null;
                const query = 'INSERT INTO lyric_sheets(title, artist, content, user_email, band_id, tab_content) VALUES($1, $2, $3, $4, $5, $6) RETURNING *';
                const result = await client.query(query, [title, artist, content, userEmail, bandId, tabContentJson]);
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            }
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/lyric-sheets:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
