const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const JWT_SECRET = process.env.JWT_SECRET;
const generateBandNumber = () => Math.floor(10000 + Math.random() * 90000);


exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.user.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required' }) };
        }
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const resource = path.split('/')[2];

        if (event.httpMethod === 'GET' && resource === 'users') {
            const query = `
                SELECT u.email, u.role, u.created_at, b.band_name
                FROM users u
                LEFT JOIN bands b ON u.band_id = b.id
                ORDER BY u.created_at DESC;
            `;
            const result = await client.query(query);
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (resource === 'create-user') {
                const { email, bandName } = body;
                if (!email || !bandName) return { statusCode: 400, body: JSON.stringify({ message: 'Email and Band Name are required.' })};

                await client.query('BEGIN');
                try {
                    const customer = await stripe.customers.create({ email, name: bandName });
                    const password_hash = await bcrypt.hash("ProAnthem", 10);
                    
                    let bandNumber;
                    let isUnique = false;
                    while(!isUnique) {
                        bandNumber = generateBandNumber();
                        const res = await client.query('SELECT id FROM bands WHERE band_number = $1', [bandNumber]);
                        if (res.rows.length === 0) isUnique = true;
                    }
                    const bandResult = await client.query('INSERT INTO bands (band_number, band_name) VALUES ($1, $2) RETURNING id', [bandNumber, bandName]);
                    const bandId = bandResult.rows[0].id;
                    
                    const userQuery = `
                        INSERT INTO users (email, password_hash, first_name, last_name, artist_band_name, band_id, stripe_customer_id, role, subscription_status, subscription_plan)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, 'solo', 'admin_granted', 'solo')
                        ON CONFLICT (email) DO NOTHING;
                    `;
                    await client.query(userQuery, [email, password_hash, 'New', 'User', bandName, bandId, customer.id]);
                    
                    await client.query('COMMIT');
                    return { statusCode: 201, body: JSON.stringify({ message: `User ${email} created with permanent solo access.` })};
                } catch (error) {
                    await client.query('ROLLBACK');
                    if (error.code === '23505') {
                        return { statusCode: 409, body: JSON.stringify({ message: 'User with this email already exists.' })};
                    }
                    throw error;
                }
            }
            
            if (resource === 'update-role') {
                const { email, newRole } = body;
                if (!email || !newRole) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newRole are required.' })};
                
                await client.query('UPDATE users SET role = $1 WHERE email = $2', [newRole, email]);
                return { statusCode: 200, body: JSON.stringify({ message: 'Role updated successfully.' }) };
            }

            if (resource === 'delete-user') {
                 const { email } = body;
                if (!email) return { statusCode: 400, body: JSON.stringify({ message: 'Email is required.' })};
                
                await client.query('BEGIN');
                try {
                    // --- FIX: Safely delete the user and their associated band data ---
                    // Step 1: Get the user's band_id before deleting them
                    const { rows: [userToDelete] } = await client.query('SELECT band_id FROM users WHERE email = $1', [email]);
                    
                    if (userToDelete) {
                        const { band_id } = userToDelete;
                        
                        // Step 2: Delete all lyric sheets and setlists associated with that band
                        // This assumes a user being deleted also means their band content is deleted.
                        await client.query('DELETE FROM lyric_sheets WHERE band_id = $1', [band_id]);
                        await client.query('DELETE FROM setlists WHERE band_id = $1', [band_id]);
                        
                        // Step 3: Delete the user(s) in that band
                        await client.query('DELETE FROM users WHERE band_id = $1', [band_id]);

                        // Step 4: Delete the band itself
                        await client.query('DELETE FROM bands WHERE id = $1', [band_id]);
                    } else {
                        // If user not found, maybe they exist without a band. Clean them up just in case.
                        await client.query('DELETE FROM users WHERE email = $1', [email]);
                    }
                    
                    await client.query('COMMIT');
                    return { statusCode: 204, body: '' };
                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error('Error during transactional delete:', error);
                    throw error; // Let the generic error handler catch it
                }
            }
        }
        
        return { statusCode: 404, body: JSON.stringify({ message: 'Admin task not found.' }) };

    } catch (error) {
        console.error('API Error in /api/admin-tasks:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
