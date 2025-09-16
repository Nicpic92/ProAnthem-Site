const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // <-- ADD BCRYPTJS
const crypto = require('crypto');   // <-- ADD CRYPTO for secure passwords

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to generate a random password
const generateTemporaryPassword = () => crypto.randomBytes(8).toString('hex');

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let adminEmail; // <-- Get the admin's email for security checks
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.user.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required' }) };
        }
        adminEmail = decoded.user.email; // Store the admin's email
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
            // No changes here
            const query = `SELECT u.email, u.role, u.created_at, b.band_name, u.band_id FROM users u LEFT JOIN bands b ON u.band_id = b.id ORDER BY u.created_at DESC;`;
            const result = await client.query(query);
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'GET' && resource === 'bands') {
            // No changes here
            const result = await client.query('SELECT id, band_name FROM bands ORDER BY band_name ASC');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }
        
        if (event.httpMethod === 'GET' && resource === 'songs') {
            // No changes here
            const result = await client.query('SELECT s.id, s.title, s.artist, b.band_name FROM lyric_sheets s JOIN bands b on s.band_id = b.id ORDER BY b.band_name, s.title');
            return { statusCode: 200, body: JSON.stringify(result.rows) };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);

            if (resource === 'reassign-user') {
                // No changes here
                const { email, newBandId } = body;
                if (!email || !newBandId) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newBandId are required.' })};
                await client.query('UPDATE users SET band_id = $1 WHERE email = $2', [newBandId, email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email} reassigned successfully.`}) };
            }
            
            if (resource === 'copy-song') {
                // No changes here
                const { songId, targetBandId } = body;
                if (!songId || !targetBandId) return { statusCode: 400, body: JSON.stringify({ message: 'songId and targetBandId are required.' })};
                await client.query('SELECT copy_song_to_band($1, $2)', [songId, targetBandId]);
                return { statusCode: 200, body: JSON.stringify({ message: `Song copied successfully.`}) };
            }

            // --- NEW: UPDATE USER ROLE ---
            if (resource === 'update-role') {
                const { email, newRole } = body;
                if (!email || !newRole) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newRole are required.' })};

                // Security: Prevent an admin from demoting themselves or another admin.
                if (email.toLowerCase() === adminEmail.toLowerCase() && newRole !== 'admin') {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Admins cannot change their own role.' })};
                }
                const { rows: [userToUpdate] } = await client.query('SELECT role FROM users WHERE email = $1', [email]);
                if (userToUpdate && userToUpdate.role === 'admin') {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Cannot change the role of another admin.' })};
                }

                await client.query('UPDATE users SET role = $1 WHERE email = $2', [newRole, email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email}'s role updated to ${newRole}.`}) };
            }

            // --- NEW: ADD NEW USER ---
            if (resource === 'add-user') {
                const { email, firstName, lastName, role, bandId } = body;
                if (!email || !firstName || !lastName || !role || !bandId) {
                    return { statusCode: 400, body: JSON.stringify({ message: 'All fields are required to add a user.' })};
                }
                const tempPassword = generateTemporaryPassword();
                const password_hash = await bcrypt.hash(tempPassword, 10);

                const query = `INSERT INTO users (email, password_hash, first_name, last_name, role, band_id, password_reset_required)
                               VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING email`;
                await client.query(query, [email.toLowerCase(), password_hash, firstName, lastName, role, bandId]);
                return { statusCode: 201, body: JSON.stringify({ message: 'User created successfully.', temporaryPassword: tempPassword }) };
            }

            // --- NEW: DELETE USER ---
            if (resource === 'delete-user') {
                const { email } = body;
                if (!email) return { statusCode: 400, body: JSON.stringify({ message: 'Email is required.' })};

                // Security: Prevent admin from deleting themselves or another admin.
                if (email.toLowerCase() === adminEmail.toLowerCase()) {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Admins cannot delete their own account.' })};
                }
                const { rows: [userToDelete] } = await client.query('SELECT role FROM users WHERE email = $1', [email]);
                if (userToDelete && userToDelete.role === 'admin') {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Cannot delete another admin account.' })};
                }

                await client.query('DELETE FROM users WHERE email = $1', [email]);
                return { statusCode: 200, body: JSON.stringify({ message: `User ${email} has been deleted.`}) };
            }
        }
        
        return { statusCode: 404, body: JSON.stringify({ message: 'Admin task not found.' }) };

    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (e.g., email already exists)
            return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
        }
        console.error('API Error in /api/admin-tasks:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
