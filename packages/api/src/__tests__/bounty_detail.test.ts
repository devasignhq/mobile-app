import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verify } from 'hono/jwt';

vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    query: {
      bounties: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { createApp } from '../app';
import { db } from '../db';

describe('GET /api/bounties/:id', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verify).mockResolvedValue({ sub: 'user-id' } as any);

    vi.mocked((db as any).select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
  });

  it('returns bounty detail with creator, assignee and applicationCount', async () => {
    vi.mocked((db.query as any).bounties.findFirst).mockResolvedValue({
      id: 'b-1',
      githubIssueId: 123,
      repoOwner: 'owner',
      repoName: 'repo',
      title: 'Fix endpoint',
      description: 'Do work',
      amountUsdc: '250.0000000',
      techTags: ['ts', 'api'],
      difficulty: 'intermediate',
      status: 'assigned',
      deadline: null,
      creatorId: 'u-1',
      assigneeId: 'u-2',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      creator: {
        id: 'u-1',
        username: 'creator_user',
        avatarUrl: 'https://img/creator.png',
      },
      assignee: {
        id: 'u-2',
        username: 'assignee_user',
        avatarUrl: 'https://img/assignee.png',
      },
    } as any);

    vi.mocked((db as any).select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 3 }]),
      }),
    });

    const res = await app.request('/api/bounties/b-1', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe('b-1');
    expect(body.creator).toEqual({
      id: 'u-1',
      username: 'creator_user',
      avatarUrl: 'https://img/creator.png',
    });
    expect(body.assignee).toEqual({
      id: 'u-2',
      username: 'assignee_user',
      avatarUrl: 'https://img/assignee.png',
    });
    expect(body.applicationCount).toBe(3);
    expect(body.status).toBe('assigned');
  });

  it('returns assignee as null when not assigned', async () => {
    vi.mocked((db.query as any).bounties.findFirst).mockResolvedValue({
      id: 'b-2',
      githubIssueId: 456,
      repoOwner: 'owner',
      repoName: 'repo',
      title: 'Open bounty',
      description: 'Still open',
      amountUsdc: '100.0000000',
      techTags: ['go'],
      difficulty: 'beginner',
      status: 'open',
      deadline: null,
      creatorId: 'u-1',
      assigneeId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      creator: {
        id: 'u-1',
        username: 'creator_user',
        avatarUrl: 'https://img/creator.png',
      },
      assignee: null,
    } as any);

    const res = await app.request('/api/bounties/b-2', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignee).toBeNull();
    expect(body.applicationCount).toBe(0);
  });

  it('returns 404 when bounty is not found', async () => {
    vi.mocked((db.query as any).bounties.findFirst).mockResolvedValue(null);

    const res = await app.request('/api/bounties/does-not-exist', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Bounty not found' });
  });
});
