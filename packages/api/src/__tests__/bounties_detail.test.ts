import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({
  verify: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    query: {
      bounties: {
        findFirst: vi.fn(),
      },
      applications: {
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('GET /api/bounties/:id', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
    vi.mocked(verify).mockResolvedValue({
      sub: 'test-user-id',
      username: 'testuser',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\\nfake\\n-----END PUBLIC KEY-----';
  });

  it('returns bounty detail with creator, assignee and application_count', async () => {
    vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
      id: 'bounty-1',
      title: 'Fix endpoint',
      status: 'assigned',
      creatorId: 'creator-1',
      assigneeId: 'assignee-1',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z'),
    } as any);

    vi.mocked(db.query.applications.findMany).mockResolvedValue([
      { id: 'app-1' },
      { id: 'app-2' },
    ] as any);

    vi.mocked(db.query.users.findFirst)
      .mockResolvedValueOnce({ id: 'creator-1', username: 'alice', avatarUrl: 'https://avatar/alice.png' } as any)
      .mockResolvedValueOnce({ id: 'assignee-1', username: 'bob', avatarUrl: 'https://avatar/bob.png' } as any);

    const res = await app.request('/api/bounties/bounty-1', {
      headers: { Authorization: 'Bearer valid.token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe('bounty-1');
    expect(body.status).toBe('assigned');
    expect(body.application_count).toBe(2);
    expect(body.creator).toEqual({ username: 'alice', avatar_url: 'https://avatar/alice.png' });
    expect(body.assignee).toEqual({ username: 'bob', avatar_url: 'https://avatar/bob.png' });
  });

  it('returns 404 when bounty does not exist', async () => {
    vi.mocked(db.query.bounties.findFirst).mockResolvedValue(null as any);

    const res = await app.request('/api/bounties/missing', {
      headers: { Authorization: 'Bearer valid.token' },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Bounty not found');
  });
});
