// --- START OF FILE netlify/functions/stage-plots.js ---

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event) => {
    // 1. Authentication & Authorization
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

    // A user must be part of a band to access this feature.
    const { band_id: bandId, role: userRole } = decodedToken.user;
    if (!bandId) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: User is not part of a band.' }) };
    }
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const pathParts = event.path.split('/').filter(Boolean);
        const plotId = pathParts.length > 2 ? parseInt(pathParts[2], 10) : null;

        // 2. Handle different HTTP Methods (CRUD)

        if (event.httpMethod === 'GET') {
            if (plotId) {
                // Get a single plot by its ID
                const { rows: [plot] } = await client.query('SELECT * FROM stage_plots WHERE id = $1 AND band_id = $2', [plotId, bandId]);
                if (!plot) return { statusCode: 404, body: JSON.stringify({ message: 'Plot not found or access denied.' }) };
                return { statusCode: 200, body: JSON.stringify(plot) };
            } else {
                // Get all plots for the user's band
                const { rows } = await client.query('SELECT id, plot_name, updated_at FROM stage_plots WHERE band_id = $1 ORDER BY updated_at DESC', [bandId]);
                return { statusCode: 200, body: JSON.stringify(rows) };
            }
        }

        if (event.httpMethod === 'POST') {
            const { plot_name, plot_data, tech_rider_data } = JSON.parse(event.body);
            const query = `INSERT INTO stage_plots (band_id, plot_name, plot_data, tech_rider_data) 
                           VALUES ($1, $2, $3, $4) RETURNING *`;
            const { rows: [newPlot] } = await client.query(query, [bandId, plot_name, plot_data, tech_rider_data]);
            return { statusCode: 201, body: JSON.stringify(newPlot) };
        }

        if (event.httpMethod === 'PUT' && plotId) {
            const { plot_name, plot_data, tech_rider_data } = JSON.parse(event.body);
            const query = `UPDATE stage_plots 
                           SET plot_name = $1, plot_data = $2, tech_rider_data = $3 
                           WHERE id = $4 AND band_id = $5 RETURNING *`;
            const { rows: [updatedPlot] } = await client.query(query, [plot_name, plot_data, tech_rider_data, plotId, bandId]);
            if (!updatedPlot) return { statusCode: 404, body: JSON.stringify({ message: 'Plot not found or access denied.' }) };
            return { statusCode: 200, body: JSON.stringify(updatedPlot) };
        }

        if (event.httpMethod === 'DELETE' && plotId) {
            const result = await client.query('DELETE FROM stage_plots WHERE id = $1 AND band_id = $2', [plotId, bandId]);
            if (result.rowCount === 0) return { statusCode: 404, body: JSON.stringify({ message: 'Plot not found or access denied.' }) };
            return { statusCode: 204, body: '' };
        }

        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };

    } catch (error) {
        console.error('API Error in /api/stage-plots:', error);
        return { statusCode: 500, body: JSON.stringify({ message: `Internal Server Error: ${error.message}` }) };
    } finally {
        if (client) await client.end();
    }
};

// --- END OF FILE netlify/functions/stage-plots.js ---
