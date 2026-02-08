const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    const { email, password } = req.body;
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        const { rows: [user] } = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const token = jwt.sign({ 
            user: { email: user.email, role: user.role, name: user.first_name, band_id: user.band_id } 
        }, process.env.JWT_SECRET, { expiresIn: '1d' });
        return res.status(200).json({ message: 'Login successful.', token });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
    } finally { await client.end(); }
}
