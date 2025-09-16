// --- START OF FILE public/js/api.js ---

// This file centralizes all communication with the backend API.

function getToken() {
    return localStorage.getItem('user_token');
}

// Universal API request function
export async function apiRequest(endpoint, data = null, method = 'GET') {
    const token = getToken();
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (data) {
        options.body = JSON.stringify(data);
    }
    try {
        const response = await fetch(`/api/${endpoint}`, options);
        if (response.status === 204) return null;
        const responseData = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                localStorage.removeItem('user_token');
                window.location.href = '/proanthem_index.html';
            }
            throw new Error(responseData.message || `API Error: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error(`API Request Error to ${endpoint}:`, error);
        throw error;
    }
}

// Export specific API calls for different parts of the app to use
export const getSheets = () => apiRequest('lyric-sheets');
export const getSheet = (id) => apiRequest(`lyric-sheets/${id}`);
export const createSheet = (data) => apiRequest('lyric-sheets', data, 'POST');
export const updateSheet = (id, data) => apiRequest(`lyric-sheets/${id}`, data, 'PUT');
export const deleteSheet = (id) => apiRequest(`lyric-sheets/${id}`, null, 'DELETE');

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

export const login = (credentials) => apiRequest('login', credentials, 'POST');
export const signup = (payload) => apiRequest('signup', payload, 'POST');
export const changePassword = (payload) => apiRequest('band/change-password', payload, 'POST');

export const createCheckoutSession = (plan) => apiRequest('stripe/create-checkout-session', { plan }, 'POST');
export const createCustomerPortal = () => apiRequest('stripe/create-customer-portal', {}, 'POST');

export const getBandDetails = () => apiRequest('band');
export const getBandMembers = () => apiRequest('band/members');
export const addBandMember = (data) => apiRequest('band/members', data, 'POST');
export const removeBandMember = (email) => apiRequest('band/members', { emailToRemove: email }, 'DELETE');

export const getBandProfile = () => apiRequest('band-profile');
export const updateBandProfile = (data) => apiRequest('band-profile', data, 'PUT');

export const getCalendarEvents = () => apiRequest('band-profile/events');
export const createCalendarEvent = (data) => apiRequest('band-profile/events', data, 'POST');
export const updateCalendarEvent = (id, data) => apiRequest(`band-profile/events/${id}`, data, 'PUT');
export const deleteCalendarEvent = (id) => apiRequest(`band-profile/events/${id}`, null, 'DELETE');
