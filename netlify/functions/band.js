const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // Built-in Node.js module for generating secure tokens

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let decodedToken;
    try {
        const token = authHeader.split(' ')[1];
        decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
    
    const { email: userEmail, band_id: bandId, role: userRole } = decodedToken.user;
    
    // Security Check: Only band_admins or admins can manage a band
    if (userRole !== 'band_admin' && userRole !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: You do not have permission to manage this band.' })};
    }
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', ''); //  /band, /band/members, etc.
        const pathParts = path.split('/').filter(Boolean);
        const resource = pathParts[1]; // 'members' or 'invites'

        if (event.httpMethod === 'GET' && resource === 'members') {
            const query = `SELECT id, email, first_name, last_name, role FROM users WHERE band_id = $1 ORDER BY email`;
            const result = await client.query(query, [bandId]);
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }

        if (event.httpMethod === 'POST' && resource === 'invites') {
            const { emailToInvite } = JSON.parse(event.body);
            if (!emailToInvite) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Email to invite is required.' })};
            }

            const inviteToken = crypto.randomBytes(32).toString('hex');
            
            // Check if user already exists in the system or in the band
            const { rows: [existingUser] } = await client.query('SELECT band_id FROM users WHERE email = $1', [emailToInvite.toLowerCase()]);
            if (existingUser) {
                return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists in the system.' }) };
            }

            const query = `
                INSERT INTO band_invites (band_id, email, token)
                VALUES ($1, $2, $3)
                ON CONFLICT (band_id, email) DO UPDATE SET token = EXCLUDED.token
                RETURNING *;
            `;
            const result = await client.query(query, [bandId, emailToInvite.toLowerCase(), inviteToken]);
            
            // In a real application, you would email this link:
            const signupLink = `${process.env.SITE_URL}/pricing.html?invite_token=${inviteToken}`;
            console.log(`SIGNUP LINK (for dev): ${signupLink}`);
            
            return { statusCode: 201, body: JSON.stringify({ message: 'Invite sent successfully.' }) };
        }

        if (event.httpMethod === 'DELETE' && resource === 'members') {
            const { userIdToRemove } = JSON.parse(event.body);
            if (!userIdToRemove) {
                 return { statusCode: 400, body: JSON.stringify({ message: 'User ID to remove is required.' })};
            }
            // You can't remove yourself, the band_admin
            const { rows: [userToRemove] } = await client.query('SELECT email FROM users WHERE id = $1', [userIdToRemove]);
            if(userToRemove.email === userEmail) {
                 return { statusCode: 403, body: JSON.stringify({ message: 'You cannot remove yourself from the band.' })};
            }

            await client.query('DELETE FROM users WHERE id = $1 AND band_id = $2', [userIdToRemove, bandId]);
            return { statusCode: 204, body: '' };
        }

        return { statusCode: 404, body: JSON.stringify({ message: 'Band management route not found.' }) };
    } catch(error) {
        console.error('API Error in /api/band:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if(client) await client.end();
    }
};
