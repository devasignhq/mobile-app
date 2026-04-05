import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Get or create a Redis client instance.
 * Returns null if REDIS_URL is not configured.
 */
export function getRedisClient(): Redis | null {
    if (!process.env.REDIS_URL) {
        return null;
    }

    if (!redis) {
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) return null;
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });

        redis.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });

        redis.on('connect', () => {
            console.log('[Redis] Connected successfully');
        });
    }

    return redis;
}

/**
 * Get a cached value from Redis and parse it as JSON.
 * Returns null if Redis is not available or key does not exist.
 */
export async function getCached<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
        const cached = await client.get(key);
        if (cached) {
            return JSON.parse(cached) as T;
        }
        return null;
    } catch (err) {
        console.error(`[Redis] Get error for key ${key}:`, err);
        return null;
    }
}

/**
 * Set a cached value in Redis with a TTL (in seconds).
 */
export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    if (!client) return;

    try {
        await client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        console.error(`[Redis] Set error for key ${key}:`, err);
    }
}

/**
 * Delete a cached key from Redis.
 */
export async function deleteCache(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;

    try {
        await client.del(key);
    } catch (err) {
        console.error(`[Redis] Delete error for key ${key}:`, err);
    }
}

/**
 * Delete all cached keys matching a pattern (e.g., "bounty:list:*").
 * Uses SCAN to avoid blocking Redis.
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
    const client = getRedisClient();
    if (!client) return;

    try {
        let cursor = '0';
        const keysToDelete: string[] = [];
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            keysToDelete.push(...keys);
        } while (cursor !== '0');

        if (keysToDelete.length > 0) {
            await client.del(...keysToDelete);
            console.log(`[Redis] Deleted ${keysToDelete.length} keys matching pattern: ${pattern}`);
        }
    } catch (err) {
        console.error(`[Redis] Pattern delete error for ${pattern}:`, err);
    }
}
