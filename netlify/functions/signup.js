const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const generateBandNumber = () => Math.floor(10000 + Math.random() * 90000);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password, firstName, lastName, artistBandName, inviteToken } = JSON.parse(event.body);

    if (!email || !password || !firstName || !lastName) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required user fields.' }) };
    }
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        await client.query('BEGIN');
        
        const password_hash = await bcrypt.hash(password, 10);
        let bandId;
        let role = 'solo'; // Default role

        if (inviteToken) {
            // --- INVITED USER FLOW ---
            const inviteQuery = 'SELECT band_id FROM band_invites WHERE token = $1 AND status = \'pending\' AND lower(email) = $2';
            const { rows: [invite] } = await client.query(inviteQuery, [inviteToken, email.toLowerCase()]);

            if (!invite) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Invalid or expired invitation token.' })};
            }
            bandId = invite.band_id;
            role = 'band_member';

            // Mark the invite as accepted
            await client.query('UPDATE band_invites SET status = \'accepted\' WHERE token = $1', [inviteToken]);

             const userInsertQuery = `
                INSERT INTO users (email, password_hash, first_name, last_name, band_id, role)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            await client.query(userInsertQuery, [email, password_hash, firstName, lastName, bandId, role]);

        } else {
            // --- NEW BAND ADMIN/SOLO USER FLOW ---
            if (!artistBandName) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Artist/Band Name is required.' }) };
            }
            const customer = await stripe.customers.create({ email, name: `${firstName} ${lastName}` });

            let bandNumber;
            let isUnique = false;
            while (!isUnique) {
                bandNumber = generateBandNumber();
                const res = await client.query('SELECT id FROM bands WHERE band_number = $1', [bandNumber]);
                if (res.rows.length === 0) isUnique = true;
            }
            
            const bandResult = await client.query('INSERT INTO bands (band_number, band_name) VALUES ($1, $2) RETURNING id', [bandNumber, artistBandName]);
            bandId = bandResult.rows[0].id;
            
            const userInsertQuery = `
                INSERT INTO users (email, password_hash, first_name, last_name, artist_band_name, band_id, stripe_customer_id, role)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING email, first_name, role;
            `;
            await client.query(userInsertQuery, [email, password_hash, firstName, lastName, artistBandName, bandId, customer.id, role]);
        }
        
        await client.query('COMMIT');
        return { statusCode: 201, body: JSON.stringify({ message: 'User created successfully.' }) };

    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
             return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
        }
        console.error('Signup Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};
