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
        const rawId = pathParts.length > 2 ? pathParts[2] : null;

        const id = rawId ? parseInt(rawId.trim(), 10) : null;
        if (rawId && isNaN(id)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid ID format.' }) };
        }

        if (id) {
            if (event.httpMethod === 'GET') {
                // MODIFIED: Only get the sheet if it belongs to the user
                const result = await client.query('SELECT * FROM lyric_sheets WHERE id = $1 AND user_email = $2', [id, userEmail]);
                if (result.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Sheet not found or access denied' }) };
                return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
            }
            if (event.httpMethod === 'PUT') {
                const { title, artist, content, audio_url } = JSON.parse(event.body);
                // MODIFIED: Only update if it belongs to the user
                const query = 'UPDATE lyric_sheets SET title = $1, artist = $2, content = $3, audio_url = $4, updated_at = NOW() WHERE id = $5 AND user_email = $6 RETURNING *';
                const result = await client.query(query, [title, artist, content, audio_url, id, userEmail]);
                return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
            }
            if (event.httpMethod === 'DELETE') {
                // MODIFIED: Only delete if it belongs to the user
                await client.query('DELETE FROM lyric_sheets WHERE id = $1 AND user_email = $2', [id, userEmail]);
                return { statusCode: 204, body: '' };
            }
        } else {
            if (event.httpMethod === 'GET') {
                // MODIFIED: Get all sheets for the specific user
                const result = await client.query('SELECT id, title, artist, updated_at FROM lyric_sheets WHERE user_email = $1 ORDER BY updated_at DESC', [userEmail]);
                return { statusCode: 200, body: JSON.stringify(result.rows) };
            }
            if (event.httpMethod === 'POST') {
                const { title, artist, content } = JSON.parse(event.body);
                // MODIFIED: Insert the sheet with the user's email
                const query = 'INSERT INTO lyric_sheets(title, artist, content, user_email) VALUES($1, $2, $3, $4) RETURNING *';
                const result = await client.query(query, [title, artist, content, userEmail]);
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            }
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/lyric-sheets:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};
