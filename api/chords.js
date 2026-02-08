// --- START OF FILE netlify/functions/chords.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // Authentication: A user must be logged in to access any chord data.
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

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const pathParts = event.path.split('/').filter(Boolean);
        const resource = pathParts[1]; // 'chords'
        const chordName = pathParts.length > 2 ? pathParts[2] : null;
        const subResource = pathParts.length > 3 ? pathParts[3] : null;

        // --- NEW ENDPOINT LOGIC ---
        // Handles GET /api/chords/:chordName/diagrams
        if (event.httpMethod === 'GET' && chordName && subResource === 'diagrams') {
            const query = 'SELECT * FROM chord_diagrams WHERE chord_name = $1';
            const { rows } = await client.query(query, [chordName]);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        // --- EXISTING FUNCTIONALITY ---
        if (event.httpMethod === 'GET' && !chordName) {
            const result = await client.query('SELECT name FROM chords ORDER BY name ASC');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'POST' && !chordName) {
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

        return { statusCode: 404, body: JSON.stringify({ message: 'Chord endpoint not found.' }) };

    } catch (error) {
        console.error('API Error in /api/chords:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};

// --- END OF FILE netlify/functions/chords.js ---
