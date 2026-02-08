// --- START OF FILE netlify/functions/finances.js ---
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
    const isAuthorizedToWrite = permissions.can_manage_band;

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const transactionId = pathParts.length > 2 ? parseInt(pathParts[2], 10) : null;

        if (event.httpMethod === 'GET') {
            const { rows } = await client.query('SELECT * FROM transactions WHERE band_id = $1 ORDER BY transaction_date DESC', [bandId]);
            return { statusCode: 200, body: JSON.stringify(rows) };
        }

        if (!isAuthorizedToWrite) {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required for this action.' }) };
        }

        if (event.httpMethod === 'POST') {
            const { transaction_date, description, amount, category } = JSON.parse(event.body);
            const query = `INSERT INTO transactions (band_id, transaction_date, description, amount, category) 
                           VALUES ($1, $2, $3, $4, $5) RETURNING *`;
            const { rows: [newTransaction] } = await client.query(query, [bandId, transaction_date, description, amount, category]);
            return { statusCode: 201, body: JSON.stringify(newTransaction) };
        }

        if (event.httpMethod === 'PUT' && transactionId) {
            const { transaction_date, description, amount, category } = JSON.parse(event.body);
            const query = `UPDATE transactions SET transaction_date = $1, description = $2, amount = $3, category = $4
                           WHERE id = $5 AND band_id = $6 RETURNING *`;
            const { rows: [updated] } = await client.query(query, [transaction_date, description, amount, category, transactionId, bandId]);
            if (!updated) return { statusCode: 404, body: JSON.stringify({ message: 'Transaction not found or access denied.' })};
            return { statusCode: 200, body: JSON.stringify(updated) };
        }

        if (event.httpMethod === 'DELETE' && transactionId) {
            const result = await client.query('DELETE FROM transactions WHERE id = $1 AND band_id = $2', [transactionId, bandId]);
            if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Transaction not found or access denied.' })};
            return { statusCode: 204, body: '' };
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/finances:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};
