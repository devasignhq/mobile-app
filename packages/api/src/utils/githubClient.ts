export class GitHubRateLimitError extends Error {
    public resetAt: Date;

    constructor(message: string, resetUnixTimestamp: number) {
        super(message);
        this.name = 'GitHubRateLimitError';
        this.resetAt = new Date(resetUnixTimestamp * 1000);
    }
}

export class GitHubApiError extends Error {
    public status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'GitHubApiError';
        this.status = status;
    }
}

export class GitHubApiClient {
    private baseUrl = 'https://api.github.com';

    constructor(private accessToken: string) {}

    /**
     * Base request handler to inject headers and handle API errors like rate limits.
     */
    async request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        const headers = new Headers(options.headers || {});
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${this.accessToken}`);
        }
        if (!headers.has('Accept')) {
            headers.set('Accept', 'application/vnd.github.v3+json');
        }
        if (!headers.has('User-Agent')) {
            headers.set('User-Agent', 'Devasign-API');
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        // 403 Could mean Rate Limit
        if (response.status === 403) {
            const checkRateLimit = response.headers.get('X-RateLimit-Remaining');
            if (checkRateLimit === '0') {
                const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10);
                throw new GitHubRateLimitError('GitHub API rate limit exceeded', resetTime);
            }
        }

        if (!response.ok) {
            let errorMsg = response.statusText;
            try {
                const errText = await response.text();
                const errData = errText ? JSON.parse(errText) : {};
                if (errData.message) {
                    errorMsg = errData.message;
                }
            } catch (e) {
                // Ignore parse errors
            }
            throw new GitHubApiError(`GitHub API error: ${errorMsg}`, response.status);
        }

        const text = await response.text();
        const responseData = (text ? JSON.parse(text) : null) as T;

        return { data: responseData, headers: response.headers };
    }

    /**
     * Parses the "Link" header for pagination.
     */
    private getNextPageUrl(linkHeader: string | null): string | null {
        if (!linkHeader) return null;

        const links = linkHeader.split(',');
        for (const link of links) {
            const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
            if (match && match[2] === 'next') {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Generic paginated fetch handler that collects all pages.
     */
    async paginate<T>(endpoint: string, options: RequestInit = {}): Promise<T[]> {
        const results: T[] = [];
        let url: string | null = endpoint;

        while (url) {
            const { data, headers } = await this.request<T[]>(url, options);
            results.push(...data);
            url = this.getNextPageUrl(headers.get('Link'));
        }

        return results;
    }

    // --- Domain Specific Methods ---

    /**
     * Fetch user profile.
     */
    async getUserProfile<T = any>(): Promise<T> {
        const { data } = await this.request<T>('/user');
        return data;
    }

    /**
     * Fetch user primary email.
     */
    async getUserPrimaryEmail(): Promise<string | null> {
        try {
            const { data: emails } = await this.request<any[]>('/user/emails');
            const primaryEmail = emails.find((e) => e.primary && e.verified);
            return primaryEmail ? primaryEmail.email : (emails[0]?.email || null);
        } catch (error) {
            // Replicate existing fallback behavior if fetching fails
            return null;
        }
    }

    /**
     * Fetch all user repositories handle pagination over all pages.
     */
    async getRepositories(): Promise<any[]> {
        return this.paginate<any>('/user/repos?per_page=100');
    }

    /**
     * Fetch languages used in a specific repository.
     */
    async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
        const { data } = await this.request<Record<string, number>>(`/repos/${owner}/${repo}/languages`);
        return data;
    }

    /**
     * Fetch a specific Pull Request details.
     */
    async getPRDetails(owner: string, repo: string, pullNumber: number): Promise<any> {
        const { data } = await this.request<any>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
        return data;
    }
}
