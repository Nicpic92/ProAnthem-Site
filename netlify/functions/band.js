// --- START OF FILE netlify/functions/band.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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

    const { band_id: bandId, email: userEmail, name: userName, permissions } = decodedToken.user;
    if (!bandId) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: User is not part of a band.' }) };
    }
    const isAuthorizedToWrite = permissions.can_manage_band;

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        const pathParts = event.path.replace('/.netlify/functions', '').replace('/api', '').split('/').filter(Boolean);
        const resource = pathParts.length > 1 ? pathParts[1] : 'details';
        
        if (event.httpMethod === 'GET' && resource === 'details') {
            const { rows: [bandDetails] } = await client.query('SELECT band_name, band_number FROM bands WHERE id = $1', [bandId]);
            if (!bandDetails) return { statusCode: 404, body: JSON.stringify({ message: 'Band not found.' }) };
            return { statusCode: 200, body: JSON.stringify(bandDetails) };
        }
        
        if (resource === 'members') {
            if (event.httpMethod === 'GET') {
                const query = `
                    SELECT u.email, u.first_name, u.last_name, r.name as role 
                    FROM users u 
                    JOIN roles r ON u.role_id = r.id 
                    WHERE u.band_id = $1 
                    ORDER BY r.id, u.first_name`;
                const { rows } = await client.query(query, [bandId]);
                return { statusCode: 200, body: JSON.stringify(rows) };
            }

            if (!isAuthorizedToWrite) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required.' }) };
            
            if (event.httpMethod === 'POST') {
                const { firstName, lastName, email } = JSON.parse(event.body);
                const token = crypto.randomBytes(32).toString('hex');
                const inviteLink = `${process.env.SITE_URL}/pricing.html?invite_token=${token}`;

                await client.query(
                    'INSERT INTO band_invites (band_id, inviter_email, email, token, status) VALUES ($1, $2, $3, $4, \'pending\')',
                    [bandId, userEmail, email.toLowerCase(), token]
                );

                const { rows: [band] } = await client.query('SELECT band_name FROM bands WHERE id = $1', [bandId]);

                const msg = {
                    to: email,
                    from: 'spreadsheetsimplicity@gmail.com',
                    subject: `You're invited to join ${band.band_name} on ProAnthem!`,
                    html: `<p>${userName} has invited you to join the band "${band.band_name}" on ProAnthem. Click the link to accept and create your account: <a href="${inviteLink}">${inviteLink}</a></p>`,
                };
                await sgMail.send(msg);

                return { statusCode: 200, body: JSON.stringify({ message: 'Invite sent successfully.', link: inviteLink }) };
            }

            if (event.httpMethod === 'DELETE') {
                const { emailToRemove } = JSON.parse(event.body);
                if (emailToRemove.toLowerCase() === userEmail.toLowerCase()) {
                    return { statusCode: 400, body: JSON.stringify({ message: 'You cannot remove yourself from the band.' }) };
                }
                
                // FIXED QUERY: This now correctly sets band_id to NULL and the role_id to 'solo' (ID=3)
                // It also correctly finds the IDs for 'admin' and 'band_admin' to prevent them from being removed.
                const { rowCount } = await client.query(
                    `UPDATE users 
                     SET band_id = NULL, role_id = (SELECT id FROM roles WHERE name = 'solo') 
                     WHERE email = $1 AND band_id = $2 
                     AND role_id NOT IN (
                         SELECT id FROM roles WHERE name IN ('admin', 'band_admin')
                     )`,
                    [emailToRemove, bandId]
                );

                if (rowCount === 0) {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Cannot remove this user. They may be a band admin or not in this band.' }) };
                }
                return { statusCode: 200, body: JSON.stringify({ message: 'User removed from band.' }) };
            }
        }
        
        if (resource === 'profile') {
            if (event.httpMethod === 'GET') {
                const { rows: [profile] } = await client.query('SELECT * FROM bands WHERE id = $1', [bandId]);
                return { statusCode: 200, body: JSON.stringify(profile) };
            }
            if (event.httpMethod === 'PUT') {
                 if (!isAuthorizedToWrite) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required.' }) };
                const p = JSON.parse(event.body);
                const query = `UPDATE bands SET band_name=$1, slug=$2, logo_url=$3, hero_image_url=$4, bio=$5, press_kit_enabled=$6, 
                               contact_public_email=$7, contact_booking_email=$8, link_website=$9, link_spotify=$10, link_apple_music=$11, 
                               link_youtube=$12, link_instagram=$13, link_facebook=$14, photo_gallery=$15 WHERE id=$16 RETURNING *`;
                const slug = p.band_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const { rows: [updated] } = await client.query(query, [p.band_name, slug, p.logo_url, p.hero_image_url, p.bio, p.press_kit_enabled,
                               p.contact_public_email, p.contact_booking_email, p.link_website, p.link_spotify, p.link_apple_music, p.link_youtube,
                               p.link_instagram, p.link_facebook, JSON.stringify(p.photo_gallery || []), bandId]);
                return { statusCode: 200, body: JSON.stringify(updated) };
            }
        }

        return { statusCode: 404, body: JSON.stringify({ message: 'Band API endpoint not found.' }) };

    } catch (error) {
        console.error('API Error in /api/band:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};
