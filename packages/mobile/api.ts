/**
 * Helper function to call the backend Gemini endpoint.
 * This replaces direct usage of the API key in the frontend.
 */
export const generateContent = async (prompt: string) => {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
