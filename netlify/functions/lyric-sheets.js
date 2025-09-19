// --- START OF FILE netlify/functions/lyric-sheets.js ---

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

        if (id) { // Operations on a specific lyric sheet
            if (event.httpMethod === 'GET') {
                if (resourceType === 'versions') {
                    if (versionId) {
                        const query = `SELECT v.* FROM lyric_sheet_versions v
                                       JOIN lyric_sheets ls ON v.lyric_sheet_id = ls.id
                                       WHERE v.id = $1 AND ls.band_id = $2`;
                        const { rows: [version] } = await client.query(query, [versionId, bandId]);
                        if (!version) return { statusCode: 404, body: JSON.stringify({ message: 'Version not found or access denied.' })};
                        return { statusCode: 200, body: JSON.stringify(version) };
                    }
                    
                    const query = `SELECT v.id, v.version_number, v.updated_by_email, v.created_at 
                                   FROM lyric_sheet_versions v
                                   JOIN lyric_sheets ls ON v.lyric_sheet_id = ls.id
                                   WHERE v.lyric_sheet_id = $1 AND ls.band_id = $2
                                   ORDER BY v.version_number DESC`;
                    const { rows } = await client.query(query, [id, bandId]);
                    return { statusCode: 200, body: JSON.stringify(rows) };
                }

                const result = await client.query('SELECT * FROM lyric_sheets WHERE id = $1 AND band_id = $2', [id, bandId]);
                if (result.rows.length === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Sheet not found or access denied' }) };
                
                const sheet = result.rows[0];
                if (sheet.song_blocks && typeof sheet.song_blocks === 'string') {
                    sheet.song_blocks = JSON.parse(sheet.song_blocks || '[]');
                }
                
                return { statusCode: 200, body: JSON.stringify(sheet) };
            }
            if (event.httpMethod === 'PUT') {
                const body = JSON.parse(event.body);
                if (!permissions.can_use_stems && body.audio_url) {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Voice Memos are a premium feature. Please upgrade to save audio.' }) };
                }

                await client.query('BEGIN');
                try {
                    const { rows: [currentSheet] } = await client.query(
                        'SELECT * FROM lyric_sheets WHERE id = $1 AND band_id = $2 FOR UPDATE',
                        [id, bandId]
                    );

                    if (!currentSheet) {
                        throw new Error('Song not found or access denied.');
                    }

                    const { rows: [lastVersion] } = await client.query(
                        'SELECT MAX(version_number) as max_version FROM lyric_sheet_versions WHERE lyric_sheet_id = $1',
                        [id]
                    );
                    const nextVersionNumber = (lastVersion.max_version || 0) + 1;
                    const archivedSongBlocks = JSON.stringify(currentSheet.song_blocks || []);

                    const archiveQuery = `
                        INSERT INTO lyric_sheet_versions (
                            lyric_sheet_id, version_number, title, artist, audio_url, song_blocks,
                            tuning, capo, transpose, duration, updated_by_email
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `;
                    await client.query(archiveQuery, [
                        id, nextVersionNumber, currentSheet.title, currentSheet.artist,
                        currentSheet.audio_url, archivedSongBlocks, currentSheet.tuning,
                        currentSheet.capo, currentSheet.transpose, currentSheet.duration, userEmail
                    ]);

                    const { title, artist, audio_url, song_blocks, tuning, capo, transpose, duration } = body;
                    const songBlocksJson = Array.isArray(song_blocks) ? JSON.stringify(song_blocks) : null;
                    
                    const updateQuery = `
                        UPDATE lyric_sheets 
                        SET 
                            title = $1, artist = $2, audio_url = $3, song_blocks = $4, 
                            tuning = $5, capo = $6, transpose = $7, duration = $8, updated_at = NOW() 
                        WHERE id = $9 AND band_id = $10 
                        RETURNING *`;
                    
                    const { rows: [updatedSheet] } = await client.query(updateQuery, [
                        title, artist, audio_url, songBlocksJson, tuning, capo,
                        transpose, duration, id, bandId
                    ]);
                    
                    await client.query('COMMIT');
                    return { statusCode: 200, body: JSON.stringify(updatedSheet) };

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error("Error during song update/versioning:", error);
                    return { statusCode: 500, body: JSON.stringify({ message: `Update failed: ${error.message}` }) };
                }
            }
            if (event.httpMethod === 'DELETE') {
                if (!permissions.can_manage_band) {
                    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: You do not have permission to delete songs.' }) };
                }
                
                await client.query('DELETE FROM lyric_sheets WHERE id = $1 AND band_id = $2', [id, bandId]);
                return { statusCode: 204, body: '' };
            }
        } else { // Operations on the collection
            if (event.httpMethod === 'GET') {
                const result = await client.query('SELECT id, title, artist, updated_at, duration, capo, tuning, transpose FROM lyric_sheets WHERE band_id = $1 ORDER BY updated_at DESC', [bandId]);
                return { statusCode: 200, body: JSON.stringify(result.rows) };
            }
            if (event.httpMethod === 'POST') {
                const songLimit = permissions.song_limit;
                if (songLimit !== -1) {
                    const { rows: [countResult] } = await client.query('SELECT COUNT(*) FROM lyric_sheets WHERE band_id = $1', [bandId]);
                    const songCount = parseInt(countResult.count, 10);
                    if (songCount >= songLimit) {
                        return { 
                            statusCode: 403, 
                            body: JSON.stringify({ message: `You have reached the ${songLimit}-song limit for your plan. Please upgrade.` }) 
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
        
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/lyric-sheets:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        await client.end();
    }
};
