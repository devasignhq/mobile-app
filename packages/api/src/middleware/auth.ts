import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

// Define the JWTPayload type expected from our generic access tokens
export interface JWTPayload {
    sub: string;
    username: string | null;
    exp: number;
    [key: string]: unknown; // Allow other standard JWT claims
}

// Extend Hono's Context Variables to include our user payload
export type Variables = {
    user: {
        id: string; // the 'sub' claim
        username: string | null;
    };
};

const getFormattedPublicKey = () => {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
        console.error('FATAL: JWT_PUBLIC_KEY environment variable is not set.');
        return null;
    }
    return publicKey.replace(/\\n/g, '\n');
};

/**
 * Middleware to protect routes.
 * Extracts Bearer token from the Authorization header, verifies the RS256 signature,
 * and injects the user context into the request.
 */
export const authMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    // Ensure it's either exactly 'Bearer' or starts with 'Bearer '
    if (authHeader.length > 6 && authHeader[6] !== ' ') {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.substring(6).trim();

    if (!token) {
        return c.json({ error: 'Token missing from Authorization header' }, 401);
    }

    const publicKey = getFormattedPublicKey();

    if (!publicKey) {
        return c.json({ error: 'Internal server configuration error' }, 500);
    }

    try {
        // Verify the token using the public key and RS256 algorithm
        const payload = await verify(token, publicKey, 'RS256') as JWTPayload;

        if (!payload.sub) {
            return c.json({ error: 'Invalid token payload' }, 401);
        }

        // Inject the user context into the request variables
        c.set('user', {
            id: payload.sub as string,
            username: payload.username as string | null,
        });

        await next();
    } catch (error) {
        console.error('JWT Verification Error:', error);
        // Provide a generic error message for generic verification failures (e.g., invalid signature)
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
};
