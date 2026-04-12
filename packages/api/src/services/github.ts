/**
 * GitHub Service
 * Handles OAuth token exchange and fetching user profile information.
 */

import { GitHubApiClient, GitHubRateLimitError, GitHubApiError } from '../utils/githubClient';

export interface GitHubUser {
    id: number;
    login: string;
    email: string | null;
    avatar_url: string;
    name: string | null;
    public_repos: number;
}

export interface GitHubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
    visibility: string | null;
}

export class GitHubService {
    /**
     * Env vars are read lazily (via getters) instead of in the constructor,
     * because this singleton is instantiated at module-import time — before
     * dotenv.config() has executed in index.ts.
     */
    private get clientId(): string {
        return process.env.GITHUB_CLIENT_ID || '';
    }

    private get clientSecret(): string {
        return process.env.GITHUB_CLIENT_SECRET || '';
    }

    private get redirectUri(): string {
        return process.env.GITHUB_CALLBACK_URL || '';
    }

    /**
     * Generates the GitHub OAuth authorization URL.
     */
    getAuthorizationUrl(state: string): string {
        const scopes = ['read:user', 'user:email', 'repo'];
        const url = new URL('https://github.com/login/oauth/authorize');
        url.searchParams.append('client_id', this.clientId);
        url.searchParams.append('redirect_uri', this.redirectUri);
        url.searchParams.append('scope', scopes.join(' '));
        url.searchParams.append('state', state);
        return url.toString();
    }

    /**
     * Exchanges an authorization code for an access token.
     */
    async getAccessToken(code: string): Promise<string> {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code,
                redirect_uri: this.redirectUri,
            }),
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
        }

        return data.access_token;
    }

    /**
     * Fetches the user profile from GitHub.
     */
    async getUserProfile(accessToken: string): Promise<GitHubUser> {
        const client = new GitHubApiClient(accessToken);
        
        try {
            const user = await client.getUserProfile();
            
            // If email is null, fetch it from the emails endpoint
            if (!user.email) {
                user.email = await client.getUserPrimaryEmail();
            }

            return user;
        } catch (error) {
            if (error instanceof GitHubRateLimitError || error instanceof GitHubApiError) {
                throw error;
            }
            throw new Error(`Failed to fetch GitHub user profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Fetches the user profile from GitHub using username.
     */
    async getUserProfileByUsername(username: string): Promise<GitHubUser> {
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Devasign-API',
        };

        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const response = await fetch(`https://api.github.com/users/${username}`, {
            headers,
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('GitHub user not found. If your username changed, please log in again.');
            }
            if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
                throw new Error('GitHub API rate limit exceeded. Please try again later.');
            }
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return await response.json() as GitHubUser;
    }

    /**
     * Fetches PR details using repository owner, name and pull number.
     * Uses system GITHUB_TOKEN if available.
     */
    async getPRDetails(owner: string, repo: string, pullNumber: number): Promise<any> {
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Devasign-API',
        };

        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
            headers,
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // PR not found
            }
            if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
                throw new Error('GitHub API rate limit exceeded. Please try again later.');
            }
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Analyzes the user's top repositories to detect their technical stack.
     */
    async analyzeTechStack(accessToken: string): Promise<string[]> {
        const client = new GitHubApiClient(accessToken);
        
        let repos: any[] = [];
        try {
            const { data } = await client.request<any[]>('/user/repos?per_page=100&sort=pushed');
            repos = data || [];
        } catch (error) {
            console.error('Failed to fetch repositories for stack analysis', error);
            return [];
        }

        // Sort repos by a combination of star count and recent activity and pick top 20
        repos.sort((a, b) => {
            const scoreA = (a.stargazers_count || 0) * 10 + (new Date(a.pushed_at || a.updated_at || Date.now()).getTime() / 1000000000);
            const scoreB = (b.stargazers_count || 0) * 10 + (new Date(b.pushed_at || b.updated_at || Date.now()).getTime() / 1000000000);
            return scoreB - scoreA;
        });

        const topRepos = repos.slice(0, 20);
        const stackWeights: Record<string, number> = {};

        const addWeight = (tech: string, weight: number) => {
            stackWeights[tech] = (stackWeights[tech] || 0) + weight;
        };

        for (const repo of topRepos) {
            try {
                // We shouldn't process if user doesn't own repo or no languages, but `getLanguages` handles the owner/repo.
                const repoOwner = repo.owner?.login;
                const repoName = repo.name;
                if (!repoOwner || !repoName) continue;

                const [languages, pkgStr, reqStr, cargoStr] = await Promise.all([
                    client.getLanguages(repoOwner, repoName).catch(() => null),
                    client.getFileContent(repoOwner, repoName, 'package.json').catch(() => null),
                    client.getFileContent(repoOwner, repoName, 'requirements.txt').catch(() => null),
                    client.getFileContent(repoOwner, repoName, 'Cargo.toml').catch(() => null)
                ]);

                // 1. Languages
                if (languages && typeof languages === 'object') {
                    for (const [lang, bytes] of Object.entries(languages)) {
                        // Normalize bytes into basic point scale (1 point per 10KB)
                        addWeight(lang, Math.ceil((bytes as number) / 10240));
                    }
                }

                // 2. package.json
                if (pkgStr) {
                    try {
                        const pkg = JSON.parse(pkgStr);
                        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                        if (deps['react']) addWeight('React', 10);
                        if (deps['next']) addWeight('Next.js', 10);
                        if (deps['express']) addWeight('Express', 10);
                        if (deps['vue']) addWeight('Vue', 10);
                        if (deps['@angular/core']) addWeight('Angular', 10);
                        if (deps['jest']) addWeight('Jest', 5);
                        if (deps['tailwindcss']) addWeight('Tailwind CSS', 5);
                    } catch (e) {
                         // silent catch for invalid JSON
                    }
                }

                // 3. requirements.txt
                if (reqStr) {
                    const lcReq = reqStr.toLowerCase();
                    if (lcReq.includes('django')) addWeight('Django', 10);
                    if (lcReq.includes('flask')) addWeight('Flask', 10);
                    if (lcReq.includes('fastapi')) addWeight('FastAPI', 10);
                    if (lcReq.includes('pandas')) addWeight('Pandas', 10);
                    if (lcReq.includes('numpy')) addWeight('NumPy', 10);
                }

                // 4. Cargo.toml
                if (cargoStr) {
                    if (cargoStr.includes('tokio')) addWeight('Tokio', 10);
                    if (cargoStr.includes('actix')) addWeight('Actix', 10);
                    if (cargoStr.includes('rocket')) addWeight('Rocket', 10);
                }
            } catch (err) {
                // Silently ignore individual repo errors to continue analysis
            }
        }

        // Sort technologies by highest weight, take top 20
        return Object.entries(stackWeights)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([tech]) => tech);
    }
}

export const githubService = new GitHubService();
