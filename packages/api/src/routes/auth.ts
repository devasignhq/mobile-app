import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { githubService } from '../services/github';
import { db } from '../db';
import { users, refreshTokens } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
const auth = new Hono();

// SECURITY: Use a dynamic state via cookies for CSRF protection.

/**
 * GET /auth/github
 * Redirects to GitHub for authentication
 */
auth.get('/github', (c) => {
    const state = uuidv4();
    // Set a secure, http-only cookie with the state
    setCookie(c, 'oauth_state', state, {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 600, // 10 minutes
        sameSite: 'Lax',
    });
    const url = githubService.getAuthorizationUrl(state);
    return c.redirect(url);
});

/**
 * GET /auth/github/callback
 * Handles the redirect from GitHub
 */
auth.get('/github/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const storedState = getCookie(c, 'oauth_state');

    // Clear the cookie immediately after reading it
    deleteCookie(c, 'oauth_state');

    if (!code) {
        return c.json({ error: 'Authorization code missing' }, 400);
    }

    if (!state || state !== storedState) {
        return c.json({ error: 'Invalid state' }, 400);
    }

    try {
        // 1. Exchange code for access token
        const accessToken = await githubService.getAccessToken(code);

        // 2. Fetch user profile
        const githubUser = await githubService.getUserProfile(accessToken);

        if (!githubUser.email) {
            return c.json({ error: 'GitHub account must have a verified email' }, 400);
        }

        // 3. Upsert user in database
        let user = await db.query.users.findFirst({
            where: eq(users.githubId, BigInt(githubUser.id)),
        });

        if (user) {
            // Update existing user
            await db.update(users)
                .set({
                    username: githubUser.login,
                    avatarUrl: githubUser.avatar_url,
                    email: githubUser.email,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));

            // Re-fetch the user to get the updated details
            user = await db.query.users.findFirst({
                where: eq(users.id, user.id),
            });
            if (!user) {
                throw new Error('Failed to retrieve updated user.');
            }
        } else {
            // Create new user
            const newUser = {
                id: uuidv4(),
                githubId: BigInt(githubUser.id),
                username: githubUser.login,
                avatarUrl: githubUser.avatar_url,
                email: githubUser.email,
                totalEarned: '0',
                bountiesCompleted: 0,
            };
            await db.insert(users).values(newUser);
            // Re-fetch to get the full user object with correct types (handling bigint/uuid correctly)
            user = await db.query.users.findFirst({
                where: eq(users.id, newUser.id),
            });
            if (!user) {
                throw new Error('Failed to retrieve newly created user.');
            }
        }

        // 4. Generate JWT access token
        const privateKey = process.env.JWT_PRIVATE_KEY;
        if (!privateKey) {
            console.error('FATAL: JWT_PRIVATE_KEY environment variable is not set.');
            return c.json({ error: 'Internal server configuration error' }, 500);
        }

        // Remove literal \n escape characters if they were parsed as string literals
        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

        const payload = {
            sub: user!.id,
            username: user!.username,
            exp: Math.floor(Date.now() / 1000) + (60 * 15), // 15 minutes
        };
        const token = await sign(payload, formattedPrivateKey, 'RS256');

        // 5. Generate Refresh token
        const refreshTokenValue = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        await db.insert(refreshTokens).values({
            id: uuidv4(),
            userId: user!.id,
            token: refreshTokenValue,
            expiresAt,
        });

        // 6. Respond with user and tokens
        return c.json({
            user: {
                id: user!.id,
                username: user!.username,
                email: user!.email,
                avatarUrl: user!.avatarUrl,
            },
            token,
            refreshToken: refreshTokenValue,
        });

    } catch (error) {
        console.error('OAuth Callback Error:', error);
        return c.json({ error: 'Authentication failed' }, 500);
    }
});

/**
 * POST /auth/refresh
 * Exchanges a valid refresh token for a new access token and a new refresh token (rotation)
 */
auth.post('/refresh', async (c) => {
    try {
        const body = await c.req.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return c.json({ error: 'Refresh token is required' }, 400);
        }

        // 1. Validate refresh token in database
        const storedToken = await db.query.refreshTokens.findFirst({
            where: eq(refreshTokens.token, refreshToken),
        });

        if (!storedToken) {
            return c.json({ error: 'Invalid refresh token' }, 401);
        }

        if (storedToken.expiresAt < new Date()) {
            // Clean up expired token
            await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
            return c.json({ error: 'Refresh token has expired' }, 401);
        }

        // 2. Fetch the user
        const user = await db.query.users.findFirst({
            where: eq(users.id, storedToken.userId),
        });

        if (!user) {
            return c.json({ error: 'User associated with refresh token no longer exists' }, 401);
        }

        // 3. Generate new access token
        const privateKey = process.env.JWT_PRIVATE_KEY;
        if (!privateKey) {
            console.error('FATAL: JWT_PRIVATE_KEY environment variable is not set.');
            return c.json({ error: 'Internal server configuration error' }, 500);
        }

        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

        const payload = {
            sub: user.id,
            username: user.username,
            exp: Math.floor(Date.now() / 1000) + (60 * 15), // 15 minutes
        };
        const newAccessToken = await sign(payload, formattedPrivateKey, 'RS256');

        // 4. Generate new refresh token (rotation) and delete the old one
        const newRefreshTokenValue = crypto.randomBytes(64).toString('hex');
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 30); // 30 days

        await db.transaction(async (tx) => {
            // Delete old token
            await tx.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
            // Insert new token
            await tx.insert(refreshTokens).values({
                id: uuidv4(),
                userId: user.id,
                token: newRefreshTokenValue,
                expiresAt: newExpiresAt,
            });
        });

        // 5. Return new tokens
        return c.json({
            token: newAccessToken,
            refreshToken: newRefreshTokenValue,
        });
    } catch (error) {
        console.error('Refresh Token Error:', error);
        return c.json({ error: 'Failed to refresh token' }, 500);
    }
});

/**
 * POST /auth/logout
 * Revokes a refresh token
 */
auth.post('/logout', async (c) => {
    try {
        const body = await c.req.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return c.json({ error: 'Refresh token is required' }, 400);
        }

        // Delete the refresh token from the database
        await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));

        return c.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout Error:', error);
        return c.json({ error: 'Failed to logout' }, 500);
    }
});

export default auth;
