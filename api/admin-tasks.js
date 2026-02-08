const { Client } = require('pg');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization Denied' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();
        
        // Vercel routes parameters differently; we use req.query or manual parsing
        const resource = req.url.split('/').pop();

        if (req.method === 'GET' && resource === 'users') {
            const { rows } = await client.query('SELECT email, role, band_id FROM users');
            await client.end();
            return res.status(200).json(rows);
        }

        await client.end();
        return res.status(404).json({ message: 'Task not found' });
    } catch (err) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
}
