const { Client } = require('pg');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Denied' });
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        const bandId = decoded.user.band_id;
        const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        await client.connect();
        if (req.method === 'GET') {
            const { rows } = await client.query('SELECT * FROM setlists WHERE band_id = $1', [bandId]);
            return res.status(200).json(rows);
        }
        await client.end();
    } catch (err) { return res.status(500).json({ message: err.message }); }
}
