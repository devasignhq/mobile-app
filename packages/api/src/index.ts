import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/gemini', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Gemini API key not configured on server' });
        }

        // This is where the actual Gemini API call would go.
        // For now, we'll just return a success message indicating the secure setup works.
        // In a real implementation, you would use the Google Generative AI SDK here.

        const { prompt } = req.body;

        console.log('Received prompt:', prompt);

        res.json({
            message: 'Request received securely on backend',
            status: 'success'
        });

    } catch (error) {
        console.error('Error processing Gemini request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
