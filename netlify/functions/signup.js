const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const generateBandNumber = () => Math.floor(10000 + Math.random() * 90000);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password, firstName, lastName, artistBandName } = JSON.parse(event.body);

    if (!email || !password || !firstName || !lastName || !artistBandName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'All fields are required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        await client.query('BEGIN');

        // 1. Create a Stripe Customer first
        const customer = await stripe.customers.create({
            email,
            name: `${firstName} ${lastName}`,
            metadata: {
                bandName: artistBandName
            }
        });

        // 2. Hash password and create band
        const password_hash = await bcrypt.hash(password, 10);
        let bandNumber;
        let isUnique = false;
        while (!isUnique) {
            bandNumber = generateBandNumber();
            const res = await client.query('SELECT id FROM bands WHERE band_number = $1', [bandNumber]);
            if (res.rows.length === 0) { isUnique = true; }
        }
        
        const bandInsertQuery = 'INSERT INTO bands (band_number, band_name) VALUES ($1, $2) RETURNING id';
        const bandResult = await client.query(bandInsertQuery, [bandNumber, artistBandName]);
        const bandId = bandResult.rows[0].id;
        
        // 3. Insert the user into your database with their new Stripe ID
        const userInsertQuery = `
            INSERT INTO users (email, password_hash, first_name, last_name, artist_band_name, band_id, stripe_customer_id, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'solo')
            RETURNING email, first_name, role;
        `;
        const queryParams = [email, password_hash, firstName, lastName, artistBandName, bandId, customer.id];

        const result = await client.query(userInsertQuery, queryParams);
        
        await client.query('COMMIT');

        return { statusCode: 201, body: JSON.stringify({ message: 'User created successfully.', user: result.rows[0] }) };

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // Handles unique constraint violations
             return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email or band name already exists.' }) };
        }
        console.error('Signup Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
