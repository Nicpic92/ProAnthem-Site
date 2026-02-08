// --- START OF FILE netlify/functions/login.js ---

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Email and password are required.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const userQuery = `
            SELECT 
                u.email, u.password_hash, u.first_name, u.band_id, u.password_reset_required, u.subscription_status,
                r.name AS role_name,
                r.can_access_tool,
                r.song_limit,
                r.can_manage_band,
                r.can_use_setlists,
                r.can_use_stems,
                r.can_use_stage_plots,
                r.can_view_band_page -- ADDED THIS LINE
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.email = $1;
        `;
        const { rows: [user] } = await client.query(userQuery, [email.toLowerCase()]);

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return { statusCode: 401, body: JSON.stringify({ message: 'Invalid credentials.' }) };
        }
        
        const tokenPayload = {
            user: {
                email: user.email, 
                name: user.first_name,
                band_id: user.band_id,
                force_reset: user.password_reset_required || false,
                subscription_status: user.subscription_status,
                permissions: {
                    role: user.role_name,
                    can_access_tool: user.can_access_tool,
                    song_limit: user.song_limit,
                    can_manage_band: user.can_manage_band,
                    can_use_setlists: user.can_use_setlists,
                    can_use_stems: user.can_use_stems,
                    can_use_stage_plots: user.can_use_stage_plots,
                    can_view_band_page: user.can_view_band_page // ADDED THIS LINE
                }
            }
        };
        
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

        if(user.password_reset_required) {
            await client.query('UPDATE users SET password_reset_required = FALSE WHERE email = $1', [user.email]);
        }
        
        return { statusCode: 200, body: JSON.stringify({ message: 'Login successful.', token: token }) };

    } catch (error) {
        console.error('Login Function Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) {
            await client.end();
        }
    }
};
