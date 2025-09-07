const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
    // --- SECURITY: JWT Authentication ---
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
    // --- END SECURITY ---

    const client = await pool.connect();
    try {
        if (event.httpMethod === 'GET') {
            const result = await client.query('SELECT name FROM chords ORDER BY name ASC');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        if (event.httpMethod === 'POST') {
            const { name } = JSON.parse(event.body);
            if (!name || name.trim() === '') {
                return { statusCode: 400, body: JSON.stringify({ message: 'Chord name is required' }) };
            }
            try {
                const query = 'INSERT INTO chords(name) VALUES($1) RETURNING name';
                const result = await client.query(query, [name.trim()]);
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            } catch (error) {
                if (error.code === '23505') {
                    return { statusCode: 409, body: JSON.stringify({ message: 'Chord already exists' }) };
                }
                throw error;
            }
        }
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    } catch (error) {
        console.error('API Error in /api/chords:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        client.release();
    }
};
