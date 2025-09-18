// --- START OF FILE public/js/api.js ---

function getToken() {
    return localStorage.getItem('user_token');
}

export async function apiRequest(endpoint, data = null, method = 'GET') {
    const token = getToken();
    const options = { 
        method, 
        headers: {} // Start with empty headers
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        // Only add Content-Type header when sending data
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`/api/${endpoint}`, options);

        if (response.status === 401) {
            localStorage.removeItem('user_token');
            window.location.href = '/proanthem_index.html'; 
            throw new Error('Session expired. Please log in again.');
        }

        if (response.status === 204) return null;
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.message || `API Error: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error);
        throw error;
    }
}

export const getSheets = () => apiRequest('lyric-sheets');
export const getSheet = (id) => apiRequest(`lyric-sheets/${id}`);
export const createSheet = (data) => apiRequest('lyric-sheets', data, 'POST');
export const updateSheet = (id, data) => apiRequest(`lyric-sheets/${id}`, data, 'PUT');
export const deleteSheet = (id) => apiRequest(`lyric-sheets/${id}`, null, 'DELETE');

export const getVersions = (sheetId) => apiRequest(`lyric-sheets/${sheetId}/versions`);
export const getVersion = (sheetId, versionId) => apiRequest(`lyric-sheets/${sheetId}/versions/${versionId}`);

export const getChords = () => apiRequest('chords');
export const createChord = (data) => apiRequest('chords', data, 'POST');
export const getSetlists = () => apiRequest('setlists');
export const getSetlist = (id) => apiRequest(`setlists/${id}`);
export const createSetlist = (data) => apiRequest('setlists', data, 'POST');
export const deleteSetlist = (id) => apiRequest(`setlists/${id}`, null, 'DELETE');
export const addSongToSetlist = (setlistId, songId) => apiRequest(`setlists/${setlistId}/songs`, { song_id: songId }, 'POST');
export const removeSongFromSetlist = (setlistId, songId) => apiRequest(`setlists/${setlistId}/songs/${songId}`, null, 'DELETE');
export const updateSetlistDetails = (id, data) => apiRequest(`setlists/${id}`, data, 'PUT');
export const updateSetlistSongOrder = (id, song_ids) => apiRequest(`setlists/${id}/songs`, { song_ids }, 'PUT');
export const cloneSetlist = (id, newName) => apiRequest(`setlists/${id}/clone`, { newName }, 'POST');

export const login = (credentials) => apiRequest('login', credentials, 'POST');
export const signup = (payload) => apiRequest('signup', payload, 'POST');
export const changePassword = (payload) => apiRequest('band/change-password', payload, 'POST');

export const createCheckoutSession = (plan) => apiRequest('stripe/create-checkout-session', { plan }, 'POST');
export const createCustomerPortal = () => apiRequest('stripe/create-customer-portal', {}, 'POST');

export const getBandDetails = () => apiRequest('band');
export const getBandMembers = () => apiRequest('band/members');
export const addBandMember = (data) => apiRequest('band/members', data, 'POST');
export const removeBandMember = (email) => apiRequest('band/members', { emailToRemove: email }, 'DELETE');

export const getBandProfile = () => apiRequest('band/profile');
export const updateBandProfile = (data) => apiRequest('band/profile', data, 'PUT');
export const getCalendarEvents = () => apiRequest('calendar');
export const createCalendarEvent = (data) => apiRequest('calendar', data, 'POST');
export const updateCalendarEvent = (id, data) => apiRequest(`calendar/${id}`, data, 'PUT');
export const deleteCalendarEvent = (id) => apiRequest(`calendar/${id}`, null, 'DELETE');

export const getStagePlots = () => apiRequest('stage-plots');
export const getStagePlot = (id) => apiRequest(`stage-plots/${id}`);
export const createStagePlot = (data) => apiRequest('stage-plots', data, 'POST');
export const updateStagePlot = (id, data) => apiRequest(`stage-plots/${id}`, data, 'PUT');
export const deleteStagePlot = (id) => apiRequest(`stage-plots/${id}`, null, 'DELETE');

export const getChordDiagrams = (chordName) => apiRequest(`chords/${chordName}/diagrams`);

export const getSongStems = (songId) => apiRequest(`song-stems?song_id=${songId}`);
export const createSongStem = (data) => apiRequest('song-stems', data, 'POST');
export const deleteSongStem = (stemId) => apiRequest(`song-stems/${stemId}`, null, 'DELETE');

export const getTransactions = () => apiRequest('finances');
export const createTransaction = (data) => apiRequest('finances', data, 'POST');
export const updateTransaction = (id, data) => apiRequest(`finances/${id}`, data, 'PUT');
export const deleteTransaction = (id) => apiRequest(`finances/${id}`, null, 'DELETE');

export const getMerchItems = () => apiRequest('merch');
export const createMerchItem = (data) => apiRequest('merch', data, 'POST');
export const updateMerchItem = (id, data) => apiRequest(`merch/${id}`, data, 'PUT');
export const deleteMerchItem = (id) => apiRequest(`merch/${id}`, null, 'DELETE');
