/**
 * Tests for GET /bounties/:id
 *
 * Covers:
 *   ✅ 200 – bounty found with full detail payload
 *   ✅ 200 – assigned bounty includes assignee info
 *   ✅ 200 – unassigned bounty returns null assignee
 *   ✅ 400 – invalid UUID returns 400
 *   ✅ 404 – valid UUID but bounty not found returns 404
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Database } from "../src/db/index.js";
import { createBountyRoutes } from "../src/routes/bounties.js";
import { Hono } from "hono";

// ── Helpers ───────────────────────────────────────────────────────────────

const VALID_UUID = "018d47a3-2c5e-4b6f-8a91-0e3f5b2c7d1a";
const VALID_UUID_2 = "12345678-1234-4234-8234-123456789abc";
const INVALID_ID = "not-a-uuid";

function makeDate(s: string) {
  return new Date(s);
}

const BASE_BOUNTY = {
  id: VALID_UUID,
  githubIssueId: BigInt(42),
  repoOwner: "acme",
  repoName: "frontend",
  title: "Fix layout bug",
  description: "The sidebar overflows on mobile.",
  amountUsdc: "500.000000",
  techTags: ["React", "CSS"],
  difficulty: "intermediate" as const,
  status: "open" as const,
  deadline: makeDate("2026-03-01T00:00:00Z"),
  createdAt: makeDate("2026-02-01T00:00:00Z"),
  updatedAt: makeDate("2026-02-10T00:00:00Z"),
  creatorId: VALID_UUID_2,
  creatorUsername: "alice",
  creatorAvatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  assigneeId: null,
  assigneeUsername: null,
  assigneeAvatarUrl: null,
};

const ASSIGNEE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ASSIGNED_BOUNTY = {
  ...BASE_BOUNTY,
  status: "assigned" as const,
  assigneeId: ASSIGNEE_UUID,
  assigneeUsername: "bob",
  assigneeAvatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
};

/** Build a minimal mock db that returns the given bounty rows and count. */
function buildMockDb(bountyRows: typeof BASE_BOUNTY[], appCount = 3) {
  const selectBuilder = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(bountyRows),
  };

  const countBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ total: appCount }]),
  };

  let callCount = 0;
  const mockDb = {
    select: vi.fn(() => {
      callCount++;
      // First call = bounty + joins; second call = application count
      return callCount === 1 ? selectBuilder : countBuilder;
    }),
    alias: vi.fn((table: unknown, alias: string) => ({ ...table, _alias: alias })),
  } as unknown as Database;

  return mockDb;
}

/** Spin up a test Hono app with the bounty routes and the given mock db. */
function buildApp(mockDb: Database) {
  const app = new Hono();
  app.route("/bounties", createBountyRoutes(mockDb));
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /bounties/:id", () => {
  it("returns 200 with full bounty detail for an open, unassigned bounty", async () => {
    const app = buildApp(buildMockDb([BASE_BOUNTY]));

    const res = await app.request(`/bounties/${VALID_UUID}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toMatchObject({
      id: VALID_UUID,
      title: "Fix layout bug",
      status: "open",
      applicationCount: 3,
      creator: {
        id: VALID_UUID_2,
        username: "alice",
        avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      },
      assignee: null,
    });
  });

  it("returns assignee info when the bounty is assigned", async () => {
    const app = buildApp(buildMockDb([ASSIGNED_BOUNTY], 5));

    const res = await app.request(`/bounties/${VALID_UUID}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("assigned");
    expect(body.data.assignee).toMatchObject({
      id: ASSIGNEE_UUID,
      username: "bob",
      avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4",
    });
    expect(body.data.applicationCount).toBe(5);
  });

  it("returns 404 when the bounty does not exist", async () => {
    const app = buildApp(buildMockDb([]));

    const res = await app.request(`/bounties/${VALID_UUID}`);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 400 for a non-UUID id", async () => {
    // db should not be touched for invalid ids
    const mockDb = buildMockDb([]);
    const app = buildApp(mockDb);

    const res = await app.request(`/bounties/${INVALID_ID}`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
    // db.select should never have been called
    expect((mockDb.select as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("includes all required fields in the response payload", async () => {
    const app = buildApp(buildMockDb([BASE_BOUNTY]));

    const res = await app.request(`/bounties/${VALID_UUID}`);
    const body = await res.json();
    const fields: Array<keyof typeof body.data> = [
      "id", "githubIssueId", "repoOwner", "repoName",
      "title", "description", "amountUsdc", "techTags",
      "difficulty", "status", "deadline", "applicationCount",
      "creator", "assignee", "createdAt", "updatedAt",
    ];
    for (const field of fields) {
      expect(body.data).toHaveProperty(field);
    }
  });
});
