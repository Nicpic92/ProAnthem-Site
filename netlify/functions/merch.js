// --- START OF FILE netlify/functions/merch.js ---
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

    const { band_id: bandId, role: userRole } = decodedToken.user;
    if (!bandId) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: User is not part of a band.' }) };
    }
    const isAuthorizedToWrite = userRole === 'admin' || userRole === 'band_admin';

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const merchId = pathParts.length > 2 ? parseInt(pathParts[2], 10) : null;

        if (event.httpMethod === 'GET') {
            const { rows } = await client.query('SELECT * FROM merch_items WHERE band_id = $1 ORDER BY item_name, variant_name', [bandId]);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        if (!isAuthorizedToWrite) {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required for this action.' }) };
        }

        if (event.httpMethod === 'POST') {
            const { item_name, variant_name, stock_quantity, price } = JSON.parse(event.body);
            const query = `INSERT INTO merch_items (band_id, item_name, variant_name, stock_quantity, price) 
                           VALUES ($1, $2, $3, $4, $5) RETURNING *`;
            const { rows: [newItem] } = await client.query(query, [bandId, item_name, variant_name, stock_quantity, price]);
            return { statusCode: 201, body: JSON.stringify(newItem) };
        }

        if (event.httpMethod === 'PUT' && merchId) {
            const { item_name, variant_name, stock_quantity, price } = JSON.parse(event.body);
            const query = `UPDATE merch_items SET item_name = $1, variant_name = $2, stock_quantity = $3, price = $4
                           WHERE id = $5 AND band_id = $6 RETURNING *`;
            const { rows: [updated] } = await client.query(query, [item_name, variant_name, stock_quantity, price, merchId, bandId]);
            if (!updated) return { statusCode: 404, body: JSON.stringify({ message: 'Item not found or access denied.' })};
            return { statusCode: 200, body: JSON.stringify(updated) };
        }

        if (event.httpMethod === 'DELETE' && merchId) {
            const result = await client.query('DELETE FROM merch_items WHERE id = $1 AND band_id = $2', [merchId, bandId]);
            if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Item not found or access denied.' })};
            return { statusCode: 204, body: '' };
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/merch:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};
// --- END OF FILE netlify/functions/merch.js ---
