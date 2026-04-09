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
}

export const githubService = new GitHubService();
