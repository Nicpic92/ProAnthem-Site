const { Client } = require('pg');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    // Destructure all possible fields from both signup forms.
    const { email, password, firstName, lastName, company, artistBandName, source } = JSON.parse(event.body);

    // Core fields are always required.
    if (!email || !password || !firstName || !lastName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required user fields.' }) };
    }

    // Differentiated validation based on the signup source.
    if (source === 'proanthem' && !artistBandName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Artist/Band Name is required for ProAnthem signup.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const password_hash = await bcrypt.hash(password, 10);

        // This single query now handles both user types.
        const query = `
            INSERT INTO users (email, password_hash, first_name, last_name, company, artist_band_name)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING email, first_name, last_name, artist_band_name, created_at;
        `;
        
        // Pass all variables. Unprovided ones will be undefined, which SQL inserts as NULL.
        const result = await client.query(query, [email, password_hash, firstName, lastName, company, artistBandName]);
        
        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'User created successfully.',
                user: result.rows[0]
            })
        };

    } catch (error) {
        if (error.code === '23505') {
            return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
        }
        console.error('Unified Signup Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};
