const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.user.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required' }) };
        }
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const resource = path.split('/')[2];

        if (event.httpMethod === 'GET' && resource === 'users') {
            const query = `SELECT u.email, u.role, u.created_at, b.band_name, u.band_id FROM users u LEFT JOIN bands b ON u.band_id = b.id ORDER BY u.created_at DESC;`;
            const result = await client.query(query);
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'GET' && resource === 'bands') {
            const result = await client.query('SELECT id, band_name FROM bands ORDER BY band_name ASC');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'GET' && resource === 'songs') {
            const result = await client.query('SELECT s.id, s.title, s.artist, b.band_name FROM lyric_sheets s JOIN bands b on s.band_id = b.id ORDER BY b.band_name, s.title');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }


        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (resource === 'reassign-user') {
                const { email, newBandId } = body;
                if (!email || !newBandId) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newBandId are required.' })};
                await client.query('UPDATE users SET band_id = $1 WHERE email = $2', [newBandId, email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email} reassigned successfully.`}) };
            }
            
            if (resource === 'copy-song') {
                const { songId, targetBandId } = body;
                if (!songId || !targetBandId) return { statusCode: 400, body: JSON.stringify({ message: 'songId and targetBandId are required.' })};
                // Call the SQL function we created earlier
                await client.query('SELECT copy_song_to_band($1, $2)', [songId, targetBandId]);
                return { statusCode: 200, body: JSON.stringify({ message: `Song copied successfully.`}) };
            }
        }
        
        return { statusCode: 404, body: JSON.stringify({ message: 'Admin task not found.' }) };

    } catch (error) {
        console.error('API Error in /api/admin-tasks:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
