// --- START OF FILE netlify/functions/signup.js ---

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
            // *** THIS IS THE REPLACED SECTION ***
            // --- SECURE INVITED USER FLOW ---
            // Find a pending invite that matches the token AND the user's email
            const inviteQuery = 'SELECT band_id FROM band_invites WHERE token = $1 AND status = \'pending\' AND lower(email) = $2';
            const { rows: [invite] } = await client.query(inviteQuery, [inviteToken, email.toLowerCase()]);

            if (!invite) {
                // This is critical for security. If the token doesn't match the email, it's invalid.
                await client.query('ROLLBACK');
                return { statusCode: 400, body: JSON.stringify({ message: 'Invalid or expired invitation token.' })};
            }
            bandId = invite.band_id;
            role = 'band_member';

            // Mark the invite as accepted so it can't be used again
            await client.query('UPDATE band_invites SET status = \'accepted\' WHERE token = $1', [inviteToken]);
            
            // Create the user, now that we've validated their invite
             const userInsertQuery = `
                INSERT INTO users (email, password_hash, first_name, last_name, band_id, role)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            await client.query(userInsertQuery, [email.toLowerCase(), password_hash, firstName, lastName, bandId, role]);

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
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            `;
            await client.query(userInsertQuery, [email.toLowerCase(), password_hash, firstName, lastName, artistBandName, bandId, customer.id, role]);
        }
        
        await client.query('COMMIT');
        
        // --- SEND WELCOME EMAIL ---
        const msg = {
            to: email,
            from: 'spreadsheetsimplicity@gmail.com',
            subject: 'Welcome to ProAnthem!',
            html: `
                <div style="font-family: Inter, system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h1 style="color: #4f46e5; text-align: center;">Welcome to ProAnthem, ${firstName}!</h1>
                    <p>We're thrilled to have you on board. Your account has been created successfully.</p>
                    <p>ProAnthem is your band's new digital command center, designed to make writing, organizing, and performing your music easier than ever.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="https://your-app-url.com/proanthem_index.html" style="background-color: #4f46e5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Log In and Get Started
                        </a>
                    </p>
                    <p>If you're a new band admin, your next step is to choose a plan to start your 3-day free trial.</p>
                    <p>If you were invited to a band, you can log in now and start collaborating immediately.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.9em; color: #777;">If you have any questions, just reply to this email.</p>
                    <p style="font-size: 0.9em; color: #777;">Rock on,<br>The ProAnthem Team</p>
                </div>
            `,
        };

        try {
            await sgMail.send(msg);
            console.log('Welcome email sent successfully to:', email);
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            if (error.response) {
                console.error(error.response.body);
            }
        }
        
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

// --- END OF FILE netlify/functions/signup.js ---
