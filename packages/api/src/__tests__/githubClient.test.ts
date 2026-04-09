import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { GitHubApiClient, GitHubRateLimitError, GitHubApiError } from '../utils/githubClient';

describe('GitHubApiClient', () => {
    let client: GitHubApiClient;
    let globalFetch: Mock;

    beforeEach(() => {
        client = new GitHubApiClient('test-token');
        globalFetch = vi.fn();
        global.fetch = globalFetch as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('base request', () => {
        it('should pass required headers on request', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers(),
                text: async () => JSON.stringify({ id: 1, login: 'testuser' }),
            });

            await client.getUserProfile();

            expect(globalFetch).toHaveBeenCalledWith(
                'https://api.github.com/user',
                expect.objectContaining({
                    headers: expect.any(Headers),
                })
            );
            
            const fetchCall = globalFetch.mock.calls[0];
            const headers = fetchCall[1].headers as Headers;
            expect(headers.get('Authorization')).toEqual('Bearer test-token');
            expect(headers.get('Accept')).toEqual('application/vnd.github.v3+json');
            expect(headers.get('User-Agent')).toEqual('Devasign-API');
        });

        it('should throw GitHubRateLimitError on 403 with RateLimit-Remaining 0', async () => {
            const headers = new Headers();
            headers.set('X-RateLimit-Remaining', '0');
            headers.set('X-RateLimit-Reset', '1600000000');

            globalFetch.mockResolvedValue({
                ok: false,
                status: 403,
                headers,
                text: async () => JSON.stringify({ message: 'API rate limit exceeded' }),
            });

            await expect(client.getUserProfile()).rejects.toThrow(GitHubRateLimitError);
            await expect(client.getUserProfile()).rejects.toMatchObject({
                resetAt: new Date(1600000000 * 1000)
            });
        });

        it('should throw GitHubApiError on basic failure', async () => {
            globalFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Headers(),
                text: async () => JSON.stringify({ message: 'Resource not found' }),
            });

            await expect(client.getUserProfile()).rejects.toThrow(GitHubApiError);
            await expect(client.getUserProfile()).rejects.toThrow('GitHub API error: Resource not found');
        });
    });

    describe('pagination', () => {
        it('should fetch multiple pages correctly', async () => {
            const linkHeaderPage1 = '<https://api.github.com/user/repos?page=2>; rel="next"';
            
            globalFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: new Headers({ Link: linkHeaderPage1 }),
                    text: async () => JSON.stringify([{ id: 1 }, { id: 2 }]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: new Headers(), // no next link
                    text: async () => JSON.stringify([{ id: 3 }, { id: 4 }]),
                });

            const repos = await client.getRepositories();
            
            expect(repos).toHaveLength(4);
            expect(repos).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
            expect(globalFetch).toHaveBeenCalledTimes(2);
            expect(globalFetch.mock.calls[0][0]).toEqual('https://api.github.com/user/repos?per_page=100');
            expect(globalFetch.mock.calls[1][0]).toEqual('https://api.github.com/user/repos?page=2');
        });
    });
});
