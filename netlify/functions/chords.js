const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // --- SECURITY: JWT Authentication ---
    // All actions on chords require a user to be logged in.
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET); // We just need to verify they are a valid user.
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

        if (event.httpMethod === 'GET') {
            // Chords are a global resource, so no user scoping is needed for GET.
            const result = await client.query('SELECT name FROM chords ORDER BY name ASC');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        if (event.httpMethod === 'POST') {
            const { name } = JSON.parse(event.body);
            if (!name || name.trim() === '') {
                return { statusCode: 400, body: JSON.stringify({ message: 'Chord name is required' }) };
            }
            try {
                // Inserting a new chord is allowed for any logged-in user.
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
        await client.end();
    }
};
