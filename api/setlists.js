// --- START OF FILE netlify/functions/setlists.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }

    let userEmail, bandId, permissions;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.user.email;
        bandId = decoded.user.band_id;
        permissions = decoded.user.permissions;
        if (!bandId) throw new Error("Token is missing band_id.");
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: `Invalid or expired token: ${err.message}` }) };
    }
    
    if (!permissions.can_use_setlists) {
        return { statusCode: 403, body: JSON.stringify({ message: 'The Show Builder is a premium feature. Please upgrade to create and manage setlists.' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const setlistId = pathParts.length > 2 && !isNaN(pathParts[2]) ? parseInt(pathParts[2]) : null;
        const resourceType = pathParts.length > 3 ? pathParts[3] : null;
        const songId = pathParts.length > 4 && !isNaN(pathParts[4]) ? parseInt(pathParts[4]) : null;

        if (event.httpMethod === 'GET') {
            if (setlistId && !resourceType) {
                const query = `SELECT id, name, venue, event_date, notes, logo_url FROM setlists WHERE id = $1 AND band_id = $2;`;
                const setlistResult = await client.query(query, [setlistId, bandId]);
                if (setlistResult.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Setlist not found or access denied' }) };

                const songsQuery = `
                    SELECT 
                        ls.id, ls.title, ls.artist, ls.song_blocks, 
                        ls.duration, ls.capo, ls.tuning, ls.transpose
                    FROM setlist_songs ss
                    JOIN lyric_sheets ls ON ss.song_id = ls.id
                    WHERE ss.setlist_id = $1 AND ls.band_id = $2
                    ORDER BY ss.song_order ASC;
                `;
                const songsResult = await client.query(songsQuery, [setlistId, bandId]);
                const setlist = { ...setlistResult.rows[0], songs: songsResult.rows };
                return { statusCode: 200, body: JSON.stringify(setlist) };
            } else {
                const result = await client.query('SELECT id, name FROM setlists WHERE band_id = $1 ORDER BY name ASC', [bandId]);
                return { statusCode: 200, body: JSON.stringify(result.rows) };
            }
        }
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');

            if (setlistId && resourceType === 'clone') {
                await client.query('BEGIN');
                try {
                    const { rows: [originalSetlist] } = await client.query(
                        'SELECT * FROM setlists WHERE id = $1 AND band_id = $2', 
                        [setlistId, bandId]
                    );
                    if (!originalSetlist) {
                        throw new Error('Original setlist not found or access denied.');
                    }
                    
                    const newName = body.newName || `${originalSetlist.name} (Copy)`;

                    const insertSetlistQuery = `INSERT INTO setlists (name, user_email, band_id, venue, event_date, notes, logo_url) 
                                                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
                    const { rows: [newSetlist] } = await client.query(insertSetlistQuery, [
                        newName, userEmail, bandId, originalSetlist.venue, originalSetlist.event_date, originalSetlist.notes, originalSetlist.logo_url
                    ]);

                    const { rows: originalSongs } = await client.query(
                        'SELECT song_id, song_order FROM setlist_songs WHERE setlist_id = $1',
                        [setlistId]
                    );

                    if (originalSongs.length > 0) {
                        const values = originalSongs.map(song => `(${newSetlist.id}, ${song.song_id}, ${song.song_order})`).join(',');
                        const insertSongsQuery = `INSERT INTO setlist_songs (setlist_id, song_id, song_order) VALUES ${values}`;
                        await client.query(insertSongsQuery);
                    }
                    
                    await client.query('COMMIT');
                    return { statusCode: 201, body: JSON.stringify(newSetlist) };
                } catch (e) {
                    await client.query('ROLLBACK');
                    console.error('Clone Setlist Error:', e);
                    return { statusCode: 500, body: JSON.stringify({ message: `Failed to clone setlist: ${e.message}` }) };
                }
            }
            
            // --- START OF FULLY REWRITTEN AND CORRECTED LOGIC ---
            if (setlistId && resourceType === 'songs') {
                await client.query('BEGIN');
                try {
                    const { song_id: songIdToAdd } = body;
                    if (!songIdToAdd) {
                        throw new Error("Song ID is missing from the request.");
                    }

                    // 1. Authorize access to the setlist.
                    const { rows: [setlist] } = await client.query('SELECT 1 FROM setlists WHERE id = $1 AND band_id = $2', [setlistId, bandId]);
                    if (!setlist) {
                        throw new Error('Forbidden: You do not have access to this setlist.');
                    }

                    // 2. Authorize access to the song and ensure it belongs to the same band.
                    const { rows: [song] } = await client.query('SELECT 1 FROM lyric_sheets WHERE id = $1 AND band_id = $2', [songIdToAdd, bandId]);
                    if (!song) {
                        throw new Error('Forbidden: The selected song was not found in your band\'s library.');
                    }

                    // 3. Explicitly check if the song is already in the setlist to prevent duplicate errors.
                    const { rowCount } = await client.query('SELECT 1 FROM setlist_songs WHERE setlist_id = $1 AND song_id = $2', [setlistId, songIdToAdd]);
                    if (rowCount > 0) {
                        await client.query('ROLLBACK'); // End the transaction before returning.
                        return { statusCode: 409, body: JSON.stringify({ message: 'This song is already in the setlist.' }) };
                    }

                    // 4. If all checks pass, proceed with insertion.
                    const maxOrderQuery = 'SELECT MAX(song_order) as max_order FROM setlist_songs WHERE setlist_id = $1';
                    const { rows: [maxOrderResult] } = await client.query(maxOrderQuery, [setlistId]);
                    const nextOrder = (maxOrderResult.max_order === null) ? 0 : maxOrderResult.max_order + 1;

                    const insertQuery = 'INSERT INTO setlist_songs (setlist_id, song_id, song_order) VALUES ($1, $2, $3) RETURNING *';
                    const { rows: [newEntry] } = await client.query(insertQuery, [setlistId, songIdToAdd, nextOrder]);
                    
                    await client.query('COMMIT');
                    return { statusCode: 201, body: JSON.stringify(newEntry) };

                } catch (e) {
                    await client.query('ROLLBACK');
                    console.error('API Error in /api/setlists/songs POST:', e);
                    
                    const isForbiddenError = e.message.startsWith('Forbidden:');
                    const statusCode = isForbiddenError ? 403 : 500;
                    const errorMessage = isForbiddenError ? e.message : 'An unexpected error occurred while adding the song.';

                    return { statusCode, body: JSON.stringify({ message: errorMessage }) };
                }
            } 
            // --- END OF CORRECTED LOGIC ---
            
            else if (!setlistId) {
                const query = 'INSERT INTO setlists (name, user_email, band_id) VALUES ($1, $2, $3) RETURNING *';
                const result = await client.query(query, [body.name, userEmail, bandId]);
                return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
            }
        }
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            if (setlistId && resourceType === 'songs') {
                const checkQuery = `SELECT 1 FROM setlists WHERE id = $1 AND band_id = $2`;
                const checkResult = await client.query(checkQuery, [setlistId, bandId]);
                if (checkResult.rows.length === 0) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
                
                const songIds = body.song_ids;
                await client.query('BEGIN');
                await client.query('DELETE FROM setlist_songs WHERE setlist_id = $1', [setlistId]);
                for (let i = 0; i < songIds.length; i++) {
                    await client.query('INSERT INTO setlist_songs (setlist_id, song_id, song_order) VALUES ($1, $2, $3)', [setlistId, songIds[i], i]);
                }
                await client.query('COMMIT');
                return { statusCode: 200, body: JSON.stringify({ message: 'Reordered successfully' }) };
            } else if (setlistId) {
                const { name, venue, event_date, notes, logo_url } = body;
                const query = `UPDATE setlists SET name = $1, venue = $2, event_date = $3, notes = $4, logo_url = $5, updated_at = NOW() WHERE id = $6 AND band_id = $7 RETURNING *`;
                const result = await client.query(query, [name, venue, event_date || null, notes, logo_url, setlistId, bandId]);
                 if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Setlist not found or access denied.' })};
                return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
            }
        }
        if (event.httpMethod === 'DELETE') {
            if (setlistId && !resourceType) {
                 await client.query('BEGIN');
                 await client.query('DELETE FROM setlist_songs WHERE setlist_id = (SELECT id FROM setlists WHERE id = $1 AND band_id = $2)', [setlistId, bandId]);
                 const result = await client.query('DELETE FROM setlists WHERE id = $1 AND band_id = $2', [setlistId, bandId]);
                 await client.query('COMMIT');
                 return { statusCode: 204, body: '' };
            }
            if (setlistId && resourceType === 'songs' && songId) {
                 const checkQuery = `SELECT 1 FROM setlists WHERE id = $1 AND band_id = $2`;
                 const checkResult = await client.query(checkQuery, [setlistId, bandId]);
                 if (checkResult.rows.length === 0) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
                
                await client.query('DELETE FROM setlist_songs WHERE setlist_id = $1 AND song_id = $2', [setlistId, songId]);
                return { statusCode: 204, body: '' };
            }
        }
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    } catch (error) {
        console.error('API Error in /api/setlists:', error);
        // Ensure rollback is attempted only if a transaction might have started.
        if (client.inTransaction) {
            await client.query('ROLLBACK').catch(console.error);
        }
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error', error: error.message }) };
    } finally {
        if (client) await client.end();
    }
};
// --- END OF FILE netlify/functions/setlists.js ---
