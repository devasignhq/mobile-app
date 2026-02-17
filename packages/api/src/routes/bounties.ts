/**
 * GET /bounties/:id — bounty detail (resolves issue #21)
 *
 * Returns full bounty details:
 *   - creator info (username, avatar)
 *   - application count
 *   - assignee info (if assigned)
 *   - current status
 */
import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { bounties } from "../db/schema/bounties.js";
import { users } from "../db/schema/users.js";
import { applications } from "../db/schema/applications.js";
import { notFound, badRequest } from "../lib/errors.js";
import type { BountyDetailApiResponse } from "../types/bounty.types.js";

// UUID v4 regex used for param validation
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Bindings = {
  db: Database;
};

export function createBountyRoutes(db: Database) {
  const router = new Hono<{ Bindings: Bindings }>();

  /**
   * GET /bounties/:id
   *
   * Returns full bounty detail including creator info, application count,
   * assignee info (if assigned), and current status.
   *
   * 200 – bounty found
   * 400 – id is not a valid UUID
   * 404 – bounty not found
   */
  router.get("/:id", async (c) => {
    const { id } = c.req.param();

    // Validate UUID format before hitting the database
    if (!UUID_RE.test(id)) {
      return badRequest(c, "Invalid bounty id — must be a valid UUID");
    }

    // ── Main bounty row + creator join ────────────────────────────────────
    const creator = db.alias(users, "creator");
    const assignee = db.alias(users, "assignee");

    const rows = await db
      .select({
        // bounty fields
        id: bounties.id,
        githubIssueId: bounties.githubIssueId,
        repoOwner: bounties.repoOwner,
        repoName: bounties.repoName,
        title: bounties.title,
        description: bounties.description,
        amountUsdc: bounties.amountUsdc,
        techTags: bounties.techTags,
        difficulty: bounties.difficulty,
        status: bounties.status,
        deadline: bounties.deadline,
        createdAt: bounties.createdAt,
        updatedAt: bounties.updatedAt,
        // creator fields
        creatorId: creator.id,
        creatorUsername: creator.username,
        creatorAvatarUrl: creator.avatarUrl,
        // assignee fields (nullable)
        assigneeId: assignee.id,
        assigneeUsername: assignee.username,
        assigneeAvatarUrl: assignee.avatarUrl,
      })
      .from(bounties)
      .innerJoin(creator, eq(bounties.creatorId, creator.id))
      .leftJoin(assignee, eq(bounties.assigneeId, assignee.id))
      .where(eq(bounties.id, id))
      .limit(1);

    if (rows.length === 0) {
      return notFound(c, `Bounty with id "${id}" not found`);
    }

    const row = rows[0];

    // ── Application count ─────────────────────────────────────────────────
    const countRows = await db
      .select({ total: count() })
      .from(applications)
      .where(eq(applications.bountyId, id));

    const applicationCount = Number(countRows[0]?.total ?? 0);

    // ── Shape the response ────────────────────────────────────────────────
    const payload: BountyDetailApiResponse = {
      data: {
        id: row.id,
        githubIssueId: Number(row.githubIssueId),
        repoOwner: row.repoOwner,
        repoName: row.repoName,
        title: row.title,
        description: row.description,
        amountUsdc: row.amountUsdc,
        techTags: (row.techTags as string[]) ?? [],
        difficulty: row.difficulty,
        status: row.status,
        deadline: row.deadline.toISOString(),
        applicationCount,
        creator: {
          id: row.creatorId,
          username: row.creatorUsername,
          avatarUrl: row.creatorAvatarUrl,
        },
        assignee:
          row.assigneeId != null
            ? {
                id: row.assigneeId,
                username: row.assigneeUsername!,
                avatarUrl: row.assigneeAvatarUrl!,
              }
            : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };

    return c.json<BountyDetailApiResponse>(payload, 200);
  });

  return router;
}
