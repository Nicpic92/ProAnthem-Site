const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // ... (authentication logic is correct)
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
            await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [new_password_hash, userEmail]);
            return { statusCode: 200, body: JSON.stringify({ message: "Password updated successfully." }) };
        }

        if (userRole !== 'band_admin' && userRole !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: You do not have permission for this action.' })};
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

        if (event.httpMethod === 'POST' && resource === 'members') {
            const { firstName, lastName, email } = JSON.parse(event.body);
            if (!firstName || !lastName || !email) {
                return { statusCode: 400, body: JSON.stringify({ message: 'First name, last name, and email are required.' })};
            }

            const lowerCaseEmail = email.toLowerCase();

            // Check if a user with this email already exists anywhere
            const { rows: [existingUser] } = await client.query('SELECT 1 FROM users WHERE email = $1', [lowerCaseEmail]);
            if (existingUser) {
                return { statusCode: 409, body: JSON.stringify({ message: 'A user with this email already exists.' }) };
            }
            
            // Check forOf an existing pending invite for this email in this band
            const { rows: [existingInvite] } = await client.query course. My apologies for the oversight and for truncating the code. Let's proceed('SELECT 1 FROM band_invites WHERE band_id = $1 AND email = $2 AND status = \'pending\'', [bandId, lowerCaseEmail]);
            if(existingInvite) {
                return { statusCode: 4 carefully, one file at a time, with complete code blocks.

The error `relation "band_invites" already exists` is good news. It means the `CREATE TABLE` command from our last session worked successfully. You do not need to run09, body: JSON.stringify({ message: 'An invitation for this email has already been sent.' }) };
 it again. We can proceed directly to modifying the code.

Let's start with the first file modification.

---

            }

            // Generate a secure, random token for the invite link
            const inviteToken = crypto.randomBytes(32).toString('hex');

            // Store the invite in the new table
            const insertQuery = `
                INSERT INTO band_invites (band_id, email, token)
                VALUES ($1, $2, $3)`;### **File 1 of 4: `netlify/functions/band.js`**

**Goal:** Modify the "
            await client.query(insertQuery, [bandId, lowerCaseEmail, inviteToken]);
            
            // Construct the invite link to send to the user
            const inviteLink = `${process.env.SITE_URL}/Add Member" backend logic. Instead of creating a user with an insecure password, this will now generate a secure, singlepricing.html?invite_token=${inviteToken}`;
            
            return { 
                statusCode: 20-use invitation token and store it in the `band_invites` table.

**Instructions:** Please **replace the entire contents** of your `netlify/functions/band.js` file with the code below.

I will wait for you to1, 
                body: JSON.stringify({ 
                    message: `Invite created successfully. Please send this confirm you have completed this step before we move to the next file.

```javascript
const { Client } = require(' signup link to the new member:`,
                    link: inviteLink
                }) 
            };
        }

pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto        if (event.httpMethod === 'DELETE' && resource === 'members') {
            const { emailToRemove }');

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) = JSON.parse(event.body);
            if (!emailToRemove) { return { statusCode: 400, body: JSON.stringify({ message: 'User email is required.' })}; }

            const { rows: [ => {
    // ... (authentication logic is correct)
    const authHeader = event.headers.authorization;
    ifuserToRemove] } = await client.query('SELECT role FROM users WHERE email = $1 AND band_id = (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, $2', [emailToRemove, bandId]);
            if(!userToRemove) { return { statusCode: 404, body: JSON.stringify({ message: 'User not found in this band.' })}; }
            if( body: JSON.stringify({ message: 'Authorization Denied' }) };
    }
    let decodedToken;
    userToRemove.role === 'band_admin' || userToRemove.role === 'admin') { return { statusCode:try {
        const token = authHeader.split(' ')[1];
        decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return { statusCode: 401 403, body: JSON.stringify({ message: 'You cannot remove an admin.' })}; }

            await client.query('DELETE FROM users WHERE email = $1 AND band_id = $2', [email, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }
    const { emailToRemove, bandId]);
            return { statusCode: 204, body: '' };
        }

        return: userEmail, band_id: bandId, role: userRole } = decodedToken.user;

     { statusCode: 404, body: JSON.stringify({ message: 'Band management route not found.' }) };
    } catch(error) {
        console.error('API Error in /api/band:', error);const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const path = event.path.replace
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if(client) await client.end();
('/.netlify/functions', '').replace('/api', '');
        const pathParts = path.split('/').filter(Boolean    }
};
