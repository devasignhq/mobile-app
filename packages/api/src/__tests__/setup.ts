import { afterEach, vi } from 'vitest';

/**
 * Global test setup file.
 *
 * Stubs required environment variables so the app module can be imported
 * without triggering process.exit() from env validation in index.ts.
 */

// Set required environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
process.env.JWT_SECRET = 'default-test-secret-for-ci-long-enough-for-validation';

// Reset all mocks after each test to prevent state leakage
afterEach(() => {
    vi.restoreAllMocks();
});
