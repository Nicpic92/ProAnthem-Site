// --- START OF FILE netlify/functions/band-profile.js (Updated) ---
// ... (imports and auth logic are unchanged) ...
// ... inside exports.handler ...
    // ... inside the try block ...
        // ...
        if (resource === 'events') {
            if (event.httpMethod === 'GET') {
                // ADD a LEFT JOIN to get the setlist_name if it's linked
                const query = `
                    SELECT e.*, s.name as setlist_name 
                    FROM events e
                    LEFT JOIN setlists s ON e.id = s.event_id
                    WHERE e.band_id = $1 
                    ORDER BY e.event_date ASC`;
                const { rows } = await client.query(query, [bandId]);
                await client.end();
                return { statusCode: 200, body: JSON.stringify(rows) };
            }

            if (event.httpMethod === 'POST' && isAuthorized) {
                const e = JSON.parse(event.body);
                await client.query('BEGIN');
                const eventQuery = `INSERT INTO events (band_id, title, event_date, venue_name, details, is_public, external_url)
                               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
                const eventValues = [bandId, e.title, e.event_date, e.venue_name, e.details, e.is_public, e.external_url];
                const { rows: [newEvent] } = await client.query(eventQuery, eventValues);
                
                // If a setlist_id is provided, link it.
                if (e.setlist_id) {
                    // First, unlink any other event from this setlist
                    await client.query('UPDATE events SET setlist_id = NULL WHERE setlist_id = $1', [e.setlist_id]);
                    await client.query('UPDATE events SET setlist_id = $1 WHERE id = $2', [e.setlist_id, newEvent.id]);
                }
                await client.query('COMMIT');
                await client.end();
                return { statusCode: 201, body: JSON.stringify(newEvent) };
            }

            if (event.httpMethod === 'PUT' && resourceId && isAuthorized) {
                const e = JSON.parse(event.body);
                await client.query('BEGIN');
                const eventQuery = `UPDATE events SET 
                                title = $1, event_date = $2, venue_name = $3, details = $4, 
                                is_public = $5, external_url = $6
                               WHERE id = $7 AND band_id = $8 RETURNING *`;
                const eventValues = [e.title, e.event_date, e.venue_name, e.details, e.is_public, e.external_url, resourceId, bandId];
                const { rows: [updatedEvent] } = await client.query(eventQuery, eventValues);

                if (e.setlist_id) {
                    // Unlink any other event from this setlist
                    await client.query('UPDATE events SET setlist_id = NULL WHERE setlist_id = $1 AND id != $2', [e.setlist_id, resourceId]);
                    // Link this setlist to this event
                    await client.query('UPDATE events SET setlist_id = $1 WHERE id = $2', [e.setlist_id, resourceId]);
                } else {
                    // If setlist_id is null or empty, unlink it from this event
                    await client.query('UPDATE events SET setlist_id = NULL WHERE id = $1', [resourceId]);
                }
                
                await client.query('COMMIT');
                await client.end();
                if (!updatedEvent) return { statusCode: 404, body: JSON.stringify({ message: 'Event not found or access denied.' })};
                return { statusCode: 200, body: JSON.stringify(updatedEvent) };
            }
            // ... (DELETE is unchanged)
        }
    // ... (rest of file)
