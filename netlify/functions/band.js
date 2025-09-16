// --- START OF FILE netlify/functions/band.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // Authentication logic
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

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const pathParts = path.split('/').filter(Boolean);
        const resource = pathParts[1];
        
        if (event.httpMethod === 'POST' && resource === 'change-password') {
            const { currentPassword, newPassword } = JSON.parse(event.body);
            if (!currentPassword || !newPassword || newPassword.length < 6) {
                return { statusCode: 400, body: JSON.stringify({ message: 'New password must be at least 6 characters.' })};
            }
            const { rows: [user] } = await client.query('SELECT password_hash FROM users WHERE email = $1', [userEmail]);
            if (!user) return { statusCode: 404, body: JSON.stringify({ message: 'User not found.' })};
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if(!isMatch) {
                return { statusCode: 401, body: JSON.stringify({ message: 'Current password is incorrect.' })};
            }
            const new_password_hash = await bcrypt.hash(newPassword, 10);
            await client.query('UPDATE users SET password_hash = $1, password_reset_required = FALSE WHERE email = $2', [new_password_hash, userEmail]);
            return { statusCode: 200, body: JSON.stringify({ message: "Password updated successfully." }) };
        }
        
        if (event.httpMethod === 'GET' && !resource) {
            const query = `SELECT band_name, band_number FROM bands WHERE id = $1`;
            const { rows: [bandDetails] } = await client.query(query, [bandId]);
            return { statusCode: 200, body: JSON.stringify(bandDetails) };
        }

        if (event.httpMethod === 'GET' && resource === 'members') {
            const query = `SELECT email, first_name, last_name, role FROM users WHERE band_id = $1 ORDER BY email`;
            const result = await client.query(query, [bandId]);
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }

        // --- PERMISSION CHECK FOR ADMIN ACTIONS ---
        // For any action beyond this point (POST, DELETE), the user must be a band_admin or admin.
        if (userRole !== 'band_admin' && userRole !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: You do not have permission for this action.' })};
        }

        if (event.httpMethod === 'POST' && resource === 'members') {
            const { firstName, lastName, email } = JSON.parse(event.body);
            if (!firstName || !lastName || !email) {
                return { statusCode: 400, body: JSON.stringify({ message: 'First name, last name, and email are required.' })};
            }

            const lowerCaseEmail = email.toLowerCase();

            const { rows: [existingUser] } = await client.query('SELECT 1 FROM users WHERE email = $1', [lowerCaseEmail]);
            if (existingUser) {
                return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
            }
            
            const { rows: [existingInvite] } = await client.query('SELECT 1 FROM band_invites WHERE band_id = $1 AND email = $2 AND status = \'pending\'', [bandId, lowerCaseEmail]);
            if(existingInvite) {
                return { statusCode: 409, body: JSON.stringify({ message: 'An invitation for this email has already been sent.' }) };
            }

            const inviteToken = crypto.randomBytes(32).toString('hex');

            const insertQuery = `
                INSERT INTO band_invites (band_id, email, token)
                VALUES ($1, $2, $3)`;
            await client.query(insertQuery, [bandId, lowerCaseEmail, inviteToken]);
            
            const inviteLink = `${process.env.SITE_URL}/pricing.html?invite_token=${inviteToken}`;
            
            return { 
                statusCode: 201, 
                body: JSON.stringify({ 
                    message: `Invite created successfully. Please send this signup link to the new member:`,
                    link: inviteLink
                }) 
            };
        }

        if (event.httpMethod === 'DELETE' && resource === 'members') {
            const { emailToRemove } = JSON.parse(event.body);
            if (!emailToRemove) { return { statusCode: 400, body: JSON.stringify({ message: 'User email is required.' })}; }

            const { rows: [userToRemove] } = await client.query('SELECT role FROM users WHERE email = $1 AND band_id = $2', [emailToRemove, bandId]);
            if(!userToRemove) { return { statusCode: 404, body: JSON.stringify({ message: 'User not found in this band.' })}; }
            if(userToRemove.role === 'band_admin' || userToRemove.role === 'admin') { return { statusCode: 403, body: JSON.stringify({ message: 'You cannot remove an admin.' })}; }

            await client.query('DELETE FROM users WHERE email = $1 AND band_id = $2', [emailToRemove, bandId]);
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
