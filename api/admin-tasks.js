const { Client } = require('pg');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
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
        // Logical migration of your admin task routing here
        // ... (remaining logic from your uploaded admin-tasks.js)
        
        await client.end();
        return res.status(200).json({ message: 'Success' });
    } catch (err) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
}
