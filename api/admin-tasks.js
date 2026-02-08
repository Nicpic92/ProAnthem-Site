const { Client } = require('pg');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Denied' });
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        if (decoded.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
        const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await client.connect();
        const path = req.url.replace('/api/admin-tasks', '');
        if (req.method === 'GET' && path === '/users') {
            const { rows } = await client.query('SELECT email, role, band_id FROM users');
            return res.status(200).json(rows);
        }
        await client.end();
        return res.status(404).json({ message: 'Not Found' });
    } catch (err) { return res.status(401).json({ message: 'Invalid Token' }); }
}
