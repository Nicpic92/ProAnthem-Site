const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const OLD_DB_URL = process.env.OLD_DATABASE_URL;
const NEW_DB_URL = process.env.DATABASE_URL;

// Helper function from signup.js to ensure consistency
const generateBandNumber = () => Math.floor(10000 + Math.random() * 90000);

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    // 1. Authenticate & Authorize: Ensure only an admin can run this.
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Authorization Denied' }) };
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.user.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admin access required' }) };
        }
    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or expired token.' }) };
    }

    // 2. Get the user email to migrate from the request body.
    const { email: userEmailToMigrate } = JSON.parse(event.body);
    if (!userEmailToMigrate) {
        return { statusCode: 400, body: JSON.stringify({ message: 'User email to migrate is required.' }) };
    }

    // 3. Set up connections to both databases.
    const oldPool = new Pool({ connectionString: OLD_DB_URL, ssl: { rejectUnauthorized: false } });
    const newPool = new Pool({ connectionString: NEW_DB_URL, ssl: { rejectUnauthorized: false } });

    const newClient = await newPool.connect(); // Use a single client for the transaction

    try {
        console.log(`Starting migration for ${userEmailToMigrate}...`);

        // 4. Fetch all data for the user from the OLD database.
        const { rows: [userToMigrate] } = await oldPool.query('SELECT * FROM users WHERE email = $1', [userEmailToMigrate]);
        if (!userToMigrate) {
            throw new Error(`User ${userEmailToMigrate} not found in the old database.`);
        }
        
        const { rows: lyricSheets } = await oldPool.query('SELECT * FROM lyric_sheets WHERE user_email = $1', [userEmailToMigrate]);
        const { rows: setlists } = await oldPool.query('SELECT * FROM setlists WHERE user_email = $1', [userEmailToMigrate]);
        
        const oldSetlistIds = setlists.map(s => s.id);
        const { rows: setlistSongs } = oldSetlistIds.length > 0
            ? await oldPool.query('SELECT * FROM setlist_songs WHERE setlist_id = ANY($1::int[])', [oldSetlistIds])
            : { rows: [] };

        console.log(`Found ${lyricSheets.length} sheets, ${setlists.length} setlists.`);

        // 5. Begin a transaction in the NEW database.
        await newClient.query('BEGIN');

        // 5a. Check if user already exists in the new DB. If so, abort.
        const { rows: [existingUser] } = await newClient.query('SELECT id FROM users WHERE email = $1', [userEmailToMigrate]);
        if (existingUser) {
            throw new Error(`User ${userEmailToMigrate} already exists in the new database. Manual action required.`);
        }

        // 5b. Create a new Band for the user.
        const bandName = userToMigrate.artist_band_name || `${userToMigrate.first_name}'s Band`;
        let bandNumber;
        let isUnique = false;
        while (!isUnique) {
            bandNumber = generateBandNumber();
            const res = await newClient.query('SELECT id FROM bands WHERE band_number = $1', [bandNumber]);
            if (res.rows.length === 0) isUnique = true;
        }
        
        const { rows: [newBand] } = await newClient.query('INSERT INTO bands (band_number, band_name) VALUES ($1, $2) RETURNING id', [bandNumber, bandName]);
        const newBandId = newBand.id;
        console.log(`Created new band '${bandName}' with ID: ${newBandId}`);

        // 6. Insert the user record with the new band_id.
        await newClient.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, company, artist_band_name, role, stripe_customer_id, band_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [userToMigrate.email, userToMigrate.password_hash, userToMigrate.first_name, userToMigrate.last_name, userToMigrate.company, userToMigrate.artist_band_name, userToMigrate.role, userToMigrate.stripe_customer_id, newBandId]
        );

        // 7. Migrate Lyric Sheets with band_id and data transformation.
        const lyricSheetIdMap = new Map();
        for (const sheet of lyricSheets) {
            const songBlocks = (sheet.content && sheet.content.trim()) 
                ? [{ id: `block_${Date.now()}`, type: 'lyrics', label: 'Main Section', content: sheet.content }] 
                : [];

            const { rows: [newSheet] } = await newClient.query(
                'INSERT INTO lyric_sheets (user_email, band_id, title, artist, song_blocks, audio_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
                [sheet.user_email, newBandId, sheet.title, sheet.artist, JSON.stringify(songBlocks), sheet.audio_url, sheet.created_at, sheet.updated_at]
            );
            lyricSheetIdMap.set(sheet.id, newSheet.id);
        }
        console.log('Lyric sheets migrated.');

        // 8. Migrate Setlists with band_id.
        const setlistIdMap = new Map();
        for (const setlist of setlists) {
            const { rows: [newSetlist] } = await newClient.query(
                'INSERT INTO setlists (user_email, band_id, name, venue, event_date, notes, logo_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
                [setlist.user_email, newBandId, setlist.name, setlist.venue, setlist.event_date, setlist.notes, setlist.logo_url, setlist.created_at, setlist.updated_at]
            );
            setlistIdMap.set(setlist.id, newSetlist.id);
        }
        console.log('Setlists migrated.');

        // 9. Migrate the Setlist-Song relationships using the new IDs.
        for (const relation of setlistSongs) {
            const newSetlistId = setlistIdMap.get(relation.setlist_id);
            const newSongId = lyricSheetIdMap.get(relation.song_id);
            if (newSetlistId && newSongId) {
                await newClient.query(
                    'INSERT INTO setlist_songs (setlist_id, song_id, song_order) VALUES ($1, $2, $3)',
                    [newSetlistId, newSongId, relation.song_order]
                );
            }
        }
        console.log('Setlist relationships migrated.');

        // 10. Commit the transaction.
        await newClient.query('COMMIT');

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Successfully migrated ${userEmailToMigrate} and all associated data.` })
        };

    } catch (err) {
        await newClient.query('ROLLBACK');
        console.error('Migration Error:', err);
        return { statusCode: 500, body: JSON.stringify({ message: `Migration failed: ${err.message}` }) };
    } finally {
        newClient.release();
        await oldPool.end();
        await newPool.end();
    }
};
