/**
 * Response shape for GET /bounties/:id
 *
 * Includes full creator info, application count, assignee info (if assigned),
 * and current status — per issue #21.
 */

export type BountyCreatorInfo = {
  id: string;
  username: string;
  avatarUrl: string;
};

export type BountyAssigneeInfo = {
  id: string;
  username: string;
  avatarUrl: string;
} | null;

export type BountyDetailResponse = {
  id: string;
  githubIssueId: number;
  repoOwner: string;
  repoName: string;
  title: string;
  description: string;
  amountUsdc: string;
  techTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "open" | "assigned" | "in_review" | "completed" | "cancelled";
  deadline: string;
  applicationCount: number;
  creator: BountyCreatorInfo;
  assignee: BountyAssigneeInfo;
  createdAt: string;
  updatedAt: string;
};

export type BountyDetailApiResponse = {
  data: BountyDetailResponse;
};
