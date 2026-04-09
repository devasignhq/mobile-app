import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { githubService } from '../services/github';
import { GitHubApiClient } from '../utils/githubClient';

vi.mock('../utils/githubClient');

describe('GitHubService - analyzeTechStack', () => {
    let mockRequest: any;
    let mockGetLanguages: any;
    let mockGetFileContent: any;

    beforeEach(() => {
        mockRequest = vi.fn();
        mockGetLanguages = vi.fn().mockResolvedValue({});
        mockGetFileContent = vi.fn().mockResolvedValue(null);

        (GitHubApiClient as any).mockImplementation(function() {
            return {
                request: mockRequest,
                getLanguages: mockGetLanguages,
                getFileContent: mockGetFileContent,
            };
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should correctly weight and sort tech stack', async () => {
        mockRequest.mockResolvedValue({ data: [
            { owner: { login: 'user1' }, name: 'repo1', stargazers_count: 10, pushed_at: new Date().toISOString() },
            { owner: { login: 'user1' }, name: 'repo2', stargazers_count: 5, pushed_at: new Date().toISOString() }
        ]});

        mockGetLanguages.mockImplementation(async (_owner: string, repo: string) => {
            if (repo === 'repo1') return { 'TypeScript': 51200 }; // 5 points
            if (repo === 'repo2') return { 'Python': 102400 }; // 10 points
            return {};
        });

        mockGetFileContent.mockImplementation(async (_owner: string, repo: string, path: string) => {
            if (repo === 'repo1' && path === 'package.json') {
                return JSON.stringify({ dependencies: { 'react': '1.0.0', 'jest': '2.0.0' } }); // React 10, Jest 5
            }
            if (repo === 'repo2' && path === 'requirements.txt') {
                return 'django==3.0\npandas==1.0'; // Django 10, Pandas 10
            }
            return null;
        });

        const techStack = await githubService.analyzeTechStack('fake-token');

        // Verify array contains the expected items
        expect(techStack).toContain('React');
        expect(techStack).toContain('Python');
        expect(techStack).toContain('Django');
        expect(techStack).toContain('Pandas');
        expect(techStack).toContain('TypeScript');
        expect(techStack).toContain('Jest');
        
        expect(techStack.length).toBe(6);
        
        // Validates correct ordering based on weights
        const firstFour = techStack.slice(0, 4);
        expect(firstFour).toContain('React');
        expect(firstFour).toContain('Python');
        expect(firstFour).toContain('Django');
        expect(firstFour).toContain('Pandas');
    });

    it('should gracefully handle repo iteration errors', async () => {
        mockRequest.mockResolvedValue({ data: [
            { owner: { login: 'user1' }, name: 'good-repo', stargazers_count: 0 },
            { owner: { login: 'user1' }, name: 'bad-repo', stargazers_count: 0 }
        ]});

        mockGetLanguages.mockImplementation(async (owner: string, repo: string) => {
            if (repo === 'bad-repo') throw new Error('API Error');
            return { 'Go': 20480 }; // 2 points
        });

        const techStack = await githubService.analyzeTechStack('fake-token');

        expect(techStack).toEqual(['Go']);
    });
});
