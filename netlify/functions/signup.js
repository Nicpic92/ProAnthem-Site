const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Helper function to generate a unique 5-digit number
const generateBandNumber = () => Math.floor(10000 + Math.random() * 90000);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password, firstName, lastName, artistBandName, source } = JSON.parse(event.body);

    if (!email || !password || !firstName || !lastName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required user fields.' }) };
    }

    if (source === 'proanthem' && !artistBandName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Artist/Band Name is required for ProAnthem signup.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        await client.query('BEGIN'); // Start transaction

        let bandId = null;
        if (source === 'proanthem') {
            // Create a new band for this user
            let bandNumber;
            let isUnique = false;
            // Ensure the generated 5-digit number is unique
            while (!isUnique) {
                bandNumber = generateBandNumber();
                const res = await client.query('SELECT id FROM bands WHERE band_number = $1', [bandNumber]);
                if (res.rows.length === 0) {
                    isUnique = true;
                }
            }
            
            const bandInsertQuery = 'INSERT INTO bands (band_number, band_name) VALUES ($1, $2) RETURNING id';
            const bandResult = await client.query(bandInsertQuery, [bandNumber, artistBandName]);
            bandId = bandResult.rows[0].id;
        }

        const password_hash = await bcrypt.hash(password, 10);

        const userInsertQuery = `
            INSERT INTO users (email, password_hash, first_name, last_name, company, artist_band_name, band_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING email, first_name, last_name, artist_band_name, created_at;
        `;
        
        const result = await client.query(userInsertQuery, [email, password_hash, firstName, lastName, company, artistBandName, bandId]);
        
        await client.query('COMMIT'); // Commit transaction

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'User and band created successfully.',
                user: result.rows[0]
            })
        };

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        if (error.code === '23505' && error.constraint === 'users_pkey') {
             return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
        }
        console.error('Unified Signup Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};
