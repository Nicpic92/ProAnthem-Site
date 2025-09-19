// --- START OF FILE netlify/functions/admin-tasks.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let adminEmail;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.user.permissions.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required' }) };
        }
        adminEmail = decoded.user.email;
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
            const query = `SELECT u.email, r.name as role, u.created_at, b.band_name, u.band_id FROM users u LEFT JOIN bands b ON u.band_id = b.id JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC;`;
            const result = await client.query(query);
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'GET' && resource === 'bands') {
            const result = await client.query('SELECT id, band_name FROM bands ORDER BY band_name ASC');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'GET' && resource === 'songs') {
            const result = await client.query('SELECT s.id, s.title, s.artist, b.band_name FROM lyric_sheets s JOIN bands b on s.band_id = b.id ORDER BY b.band_name, s.title');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (resource === 'reassign-user') {
                const { email, newBandId } = body;
                if (!email || !newBandId) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newBandId are required.' })};
                await client.query('UPDATE users SET band_id = $1 WHERE email = $2', [newBandId, email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email} reassigned successfully.`}) };
            }
            
            if (resource === 'copy-song') {
                const { songId, targetBandId } = body;
                if (!songId || !targetBandId) return { statusCode: 400, body: JSON.stringify({ message: 'songId and targetBandId are required.' })};
                await client.query('SELECT copy_song_to_band($1, $2)', [songId, targetBandId]);
                return { statusCode: 200, body: JSON.stringify({ message: `Song copied successfully.`}) };
            }

            if (resource === 'update-role') {
                const { email, newRoleName } = body;
                if (!email || !newRoleName) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newRoleName are required.' })};

                if (email.toLowerCase() === adminEmail.toLowerCase() && newRoleName !== 'admin') {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Admins cannot change their own role.' })};
                }
                const { rows: [userToUpdate] } = await client.query('SELECT r.name as role FROM users u JOIN roles r on u.role_id = r.id WHERE u.email = $1', [email]);
                if (userToUpdate && userToUpdate.role === 'admin') {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Cannot change the role of another admin.' })};
                }

                await client.query('UPDATE users SET role_id = (SELECT id FROM roles WHERE name = $1) WHERE email = $2', [newRoleName, email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email}'s role updated to ${newRoleName}.`}) };
            }

            if (resource === 'add-user') {
                const { email, firstName, lastName, roleName, bandId } = body;
                if (!email || !firstName || !lastName || !roleName || !bandId) {
                    return { statusCode: 400, body: JSON.stringify({ message: 'All fields are required to add a user.' })};
                }
                
                const { rows: [role] } = await client.query('SELECT id, name FROM roles WHERE name = $1', [roleName]);
                if (!role) {
                    return { statusCode: 404, body: JSON.stringify({ message: 'The selected role was not found.' })};
                }

                const { rows: [band] } = await client.query('SELECT band_number FROM bands WHERE id = $1', [bandId]);
                if (!band) {
                    return { statusCode: 404, body: JSON.stringify({ message: 'The selected band was not found.' })};
                }
                const tempPassword = band.band_number.toString();
                const password_hash = await bcrypt.hash(tempPassword, 10);

                const subscriptionStatus = (role.name === 'admin' || role.name === 'band_admin') ? 'admin_granted' : null;

                const query = `INSERT INTO users (email, password_hash, first_name, last_name, role_id, band_id, password_reset_required, subscription_status)
                               VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7) RETURNING email`;
                await client.query(query, [email.toLowerCase(), password_hash, firstName, lastName, role.id, bandId, subscriptionStatus]);
                
                return { statusCode: 201, body: JSON.stringify({ message: 'User created successfully.', temporaryPassword: tempPassword }) };
            }

            if (resource === 'delete-user') {
                const { email } = body;
                if (!email) return { statusCode: 400, body: JSON.stringify({ message: 'Email is required.' })};

                if (email.toLowerCase() === adminEmail.toLowerCase()) {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Admins cannot delete their own account.' })};
                }
                const { rows: [userToDelete] } = await client.query('SELECT r.name as role FROM users u JOIN roles r on u.role_id = r.id WHERE u.email = $1', [email]);
                if (userToDelete && userToDelete.role === 'admin') {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Cannot delete another admin account.' })};
                }

                await client.query('DELETE FROM users WHERE email = $1', [email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email} has been deleted.`}) };
            }
        }
        
        return { statusCode: 404, body: JSON.stringify({ message: 'Admin task not found.' }) };

    } catch (error) {
        if (error.code === '23505') { 
            return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
        }
        console.error('API Error in /api/admin-tasks:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
