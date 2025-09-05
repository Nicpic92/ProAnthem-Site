const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Email and password are required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const userResult = await client.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }

        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }

        // UPDATED: Include band_id in the JWT payload
        const tokenPayload = {
            user: {
                email: user.email,
                role: user.role,
                name: user.first_name,
                band_id: user.band_id // Add the band ID here
            }
        };
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Login successful.',
                token: token
            })
        };

    } catch (error) {
        console.error('Login Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};
