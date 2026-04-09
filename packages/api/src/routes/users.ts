import { Hono } from 'hono';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { githubService } from '../services/github';
import { Variables } from '../middleware/auth';

const usersRoute = new Hono<{ Variables: Variables }>();

/**
 * POST /users/me/sync
 * Manually synchronize user's GitHub profile data (e.g. public_repos)
 */
usersRoute.post('/me/sync', async (c) => {
    try {
        const user = c.get('user');
        
        if (!user || !user.username) {
            return c.json({ error: 'User not fully registered or missing GitHub username' }, 400);
        }

        // Fetch user data via public unauthenticated GitHub API (with username)
        const githubUser = await githubService.getUserProfileByUsername(user.username);
        
        if (!githubUser) {
            return c.json({ error: 'Failed to fetch GitHub profile' }, 500);
        }

        // Use `.returning()` to get the true database state after the update
        const [updatedUser] = await db.update(users)
            .set({
                avatarUrl: githubUser.avatar_url,
                // Note: we might not want to overwrite email if it's missing in public profile
                ...(githubUser.email ? { email: githubUser.email } : {}),
                publicRepos: githubUser.public_repos || 0,
                updatedAt: new Date(),
            })
            .where(eq(users.id, user.id))
            .returning();

        // Return updated attributes
        return c.json({
            success: true,
            avatarUrl: updatedUser.avatarUrl,
            email: updatedUser.email,
            publicRepos: updatedUser.publicRepos,
        });
    } catch (error: any) {
        console.error('Failed to sync user profile:', error);
        return c.json({ error: 'Failed to sync user profile', details: error.message }, 500);
    }
});

export default usersRoute;
