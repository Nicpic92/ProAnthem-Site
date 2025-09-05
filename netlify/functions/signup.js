const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Helper function to generate a unique 5-digit number
const generateBandNumber = () => Math.floor(10000 + Math.random() * 90000);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password, firstName, lastName, company, artistBandName, source } = JSON.parse(event.body);

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
        const password_hash = await bcrypt.hash(password, 10);
        
        // --- DYNAMIC QUERY BUILDING ---
        let userInsertQuery;
        let queryParams;

        if (source === 'proanthem') {
            // --- ProAnthem Signup Logic ---
            let bandNumber;
            let isUnique = false;
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

            userInsertQuery = `
                INSERT INTO users (email, password_hash, first_name, last_name, artist_band_name, band_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING email, first_name, last_name, artist_band_name, created_at;
            `;
            queryParams = [email, password_hash, firstName, lastName, artistBandName, bandId];

        } else {
            // --- Spreadsheet Simplicity Signup Logic (Default) ---
            userInsertQuery = `
                INSERT INTO users (email, password_hash, first_name, last_name, company)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING email, first_name, last_name, company, created_at;
            `;
            queryParams = [email, password_hash, firstName, lastName, company];
        }
        
        const result = await client.query(userInsertQuery, queryParams);
        
        await client.query('COMMIT'); // Commit transaction

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'User created successfully.',
                user: result.rows[0]
            })
        };

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        if (error.code === '23505' && error.constraint && error.constraint.includes('users')) {
             return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
        }
        console.error('Unified Signup Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
