/**
 * API helper utilities for making authenticated requests to the backend.
 */

/**
 * Returns the stored auth token, or null if not authenticated.
 */
const getToken = (): string | null => localStorage.getItem('auth_token');

/**
 * Builds common headers for authenticated API requests.
 */
const authHeaders = (): Record<string, string> => {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

/**
 * Helper function to call the backend Gemini endpoint.
 * This replaces direct usage of the API key in the frontend.
 */
export const generateContent = async (prompt: string) => {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch from backend');
        }

        return await response.json();
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
    }
};

/**
 * Generic authenticated GET request helper.
 */
export const apiGet = async (path: string) => {
    const response = await fetch(path, {
        headers: authHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `GET ${path} failed`);
    }

    return response.json();
};

/**
 * Generic authenticated POST request helper.
 */
export const apiPost = async (path: string, body: unknown) => {
    const response = await fetch(path, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `POST ${path} failed`);
    }

    return response.json();
};
