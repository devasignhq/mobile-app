export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type Status = 'Open' | 'Assigned' | 'In Review' | 'Completed' | 'Cancelled';
export type ApplicationStatus = 'Pending' | 'Accepted' | 'Rejected';
export type SubmissionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Disputed';

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
  totalEarned: number;
  bountiesCompleted: number;
  successRate: number;
  techStack: string[];
  walletAddress: string;
}

export interface Bounty {
  id: string;
  repoOwner: string;
  repoName: string;
  title: string;
  description: string;
  amount: number;
  tags: string[];
  difficulty: Difficulty;
  deadline: string; // ISO date string
  status: Status;
  creator: {
    username: string;
    avatarUrl: string;
    rating: number;
  };
  requirements: string[];
}

export interface Application {
  id: string;
  bountyId: string;
  status: ApplicationStatus;
  appliedAt: string;
}

export interface Transaction {
  id: string;
  type: 'Earning' | 'Withdrawal';
  amount: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Failed';
  description: string;
}

export interface Task {
  id: string;
  title: string;
  amount: number;
  status: string;
  repo: string;
  deadline?: string;
  submittedAt?: string;
  completedAt?: string;
}