const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // 1. --- SECURITY: Authentication & Authorization ---
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        // Only allow users with the 'admin' role to proceed
        if (decoded.user.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required' }) };
        }
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
    // --- END SECURITY ---

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        const path = event.path.replace('/.netlify/functions', '').replace('/api', '');
        const pathParts = path.split('/').filter(Boolean); // e.g., ['admin-tasks', 'users']
        const resource = pathParts.length > 1 ? pathParts[1] : null;

        // 2. --- API ROUTING ---
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

            if (resource === 'update-role') {
                const { email, newRole } = body;
                if (!email || !newRole) return { statusCode: 400, body: JSON.stringify({ message: 'Email and newRole are required.' })};
                
                await client.query('UPDATE users SET role = $1 WHERE email = $2', [newRole, email]);
                return { statusCode: 200, body: JSON.stringify({ message: 'Role updated successfully.' }) };
            }

            if (resource === 'delete-user') {
                 const { email } = body;
                if (!email) return { statusCode: 400, body: JSON.stringify({ message: 'Email is required.' })};
               
                // For safety, you might not want to delete an admin account this way.
                if (email.toLowerCase() === 'admin@admin.com') { // Example safety check
                    return { statusCode: 403, body: JSON.stringify({ message: 'Cannot delete the primary admin account.' })};
                }

                await client.query('DELETE FROM users WHERE email = $1', [email]);
                return { statusCode: 204, body: '' }; // No Content
            }
        }
        
        return { statusCode: 404, body: JSON.stringify({ message: 'Admin task not found.' }) };

    } catch (error) {
        console.error('API Error in /api/admin-tasks:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    } finally {
        await client.end();
    }
};
