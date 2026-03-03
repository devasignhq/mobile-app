import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
  db: {
    query: {
      bounties: { findMany: vi.fn(), findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
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
    process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enriched bounty detail with creator, assignee and application_count', async () => {
    vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
      id: 'b1',
      title: 'Test',
      creatorId: 'u1',
      assigneeId: 'u2',
      status: 'assigned',
    } as any);

    vi.mocked(db.query.users.findFirst)
      .mockResolvedValueOnce({ id: 'u1', username: 'creator', avatarUrl: 'creator.png' } as any)
      .mockResolvedValueOnce({ id: 'u2', username: 'assignee', avatarUrl: 'assignee.png' } as any);

    (db.select as any).mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ count: 3 }]),
      }),
    });

    const res = await app.request('/api/bounties/b1', {
      headers: { Authorization: 'Bearer valid.token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('b1');
    expect(body.creator).toEqual({ username: 'creator', avatar_url: 'creator.png' });
    expect(body.assignee).toEqual({ username: 'assignee', avatar_url: 'assignee.png' });
    expect(body.application_count).toBe(3);
    expect(body.status).toBe('assigned');
  });

  it('returns 404 when bounty does not exist', async () => {
    vi.mocked(db.query.bounties.findFirst).mockResolvedValue(undefined as any);

    const res = await app.request('/api/bounties/missing', {
      headers: { Authorization: 'Bearer valid.token' },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Bounty not found');
  });
});
