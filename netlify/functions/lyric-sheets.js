// --- START OF FILE netlify/functions/lyric-sheets.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// --- NEW: Define the free plan limit ---
const FREE_TIER_SONG_LIMIT = 3;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let userEmail, bandId, userRole, subscriptionStatus;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.user.email;
        bandId = decoded.user.band_id;
        userRole = decoded.user.role;
        subscriptionStatus = decoded.user.subscription_status; // Get plan status
        if (!bandId) throw new Error("Token is missing band_id.");
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const rawId = pathParts.length > 2 ? pathParts[2] : null;
        const id = rawId ? parseInt(rawId.trim(), 10) : null;
        if (rawId && isNaN(id)) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Invalid ID format.' }) };
        }

        const resourceType = pathParts.length > 3 ? pathParts[3] : null;
        const versionId = pathParts.length > 4 ? parseInt(pathParts[4], 10) : null;

        if (id) { 
            // ... (GET logic for specific sheet remains the same)
            if (event.httpMethod === 'PUT') {
                const body = JSON.parse(event.body);
                // --- NEW: Block free users from adding voice memos ---
                if (subscriptionStatus === 'free' && body.audio_url) {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Voice Memos are a premium feature. Please upgrade to save audio.' }) };
                }
                // ... (rest of PUT logic remains the same)
            }
            // ... (DELETE logic remains the same)
        } else { 
            if (event.httpMethod === 'GET') {
                // ... (GET logic for all sheets remains the same)
            }
            if (event.httpMethod === 'POST') {
                // --- NEW: Enforce song limit for free users ---
                if (subscriptionStatus === 'free') {
                    const { rows: [countResult] } = await client.query('SELECT COUNT(*) FROM lyric_sheets WHERE band_id = $1', [bandId]);
                    const songCount = parseInt(countResult.count, 10);
                    if (songCount >= FREE_TIER_SONG_LIMIT) {
                        return { 
                            statusCode: 403, 
                            body: JSON.stringify({ message: `You have reached the ${FREE_TIER_SONG_LIMIT}-song limit for the free plan. Please upgrade to save more songs.` }) 
                        };
                    }
                }

                const { title, artist, song_blocks, audio_url, tuning, capo, transpose, duration } = JSON.parse(event.body);
                const songBlocksJson = Array.isArray(song_blocks) ? JSON.stringify(song_blocks) : null;

                const newTuning = tuning ?? 'E_STANDARD';
                const newCapo = capo ?? 0;
                const newTranspose = transpose ?? 0;

                const query = `
                    INSERT INTO lyric_sheets(title, artist, user_email, band_id, song_blocks, audio_url, tuning, capo, transpose, duration) 
                    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                    RETURNING *`;

                const result = await client.query(query, [title, artist, userEmail, bandId, songBlocksJson, audio_url, newTuning, newCapo, newTranspose, duration]);
                
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            }
        }
        
        // --- Fallback for omitted GET/PUT/DELETE blocks to keep it clean ---
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/lyric-sheets:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
