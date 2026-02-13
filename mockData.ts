import { Bounty, User, Transaction } from './types';

export const CURRENT_USER: User = {
  id: 'u1',
  username: 'dev_wizard',
  avatarUrl: 'https://picsum.photos/seed/user/200/200',
  totalEarned: 12500.00,
  bountiesCompleted: 14,
  successRate: 98,
  techStack: ['React', 'TypeScript', 'Node.js', 'Rust', 'Solidity'],
  walletAddress: 'GDS...X7Z'
};

export const MOCK_BOUNTIES: Bounty[] = [
  {
    id: 'b1',
    repoOwner: 'facebook',
    repoName: 'react',
    title: 'Fix concurrent mode rendering edge case in large lists',
    description: 'We are experiencing a flickering issue when rendering lists with over 10,000 items in concurrent mode under specific conditions. Needs deep understanding of Fiber reconciliation.',
    amount: 5000,
    tags: ['React', 'C++', 'JavaScript'],
    difficulty: 'Advanced',
    deadline: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days left
    status: 'Open',
    creator: { username: 'acdlite', avatarUrl: 'https://picsum.photos/seed/fb/100', rating: 4.9 },
    requirements: ['Reproduce the bug with a test case', 'Fix the issue in the reconciler', 'Pass all existing regression tests']
  },
  {
    id: 'b2',
    repoOwner: 'tailwindlabs',
    repoName: 'tailwindcss',
    title: 'Add support for new CSS container queries syntax',
    description: 'Implement the latest spec for container queries including style queries. Ensure backward compatibility with the JIT engine.',
    amount: 1200,
    tags: ['CSS', 'TypeScript', 'Rust'],
    difficulty: 'Intermediate',
    deadline: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days left
    status: 'Open',
    creator: { username: 'adamwathan', avatarUrl: 'https://picsum.photos/seed/tw/100', rating: 5.0 },
    requirements: ['Update parser logic', 'Add unit tests for new syntax', 'Update documentation']
  },
  {
    id: 'b3',
    repoOwner: 'shadcn',
    repoName: 'ui',
    title: 'Create a new date range picker component',
    description: 'We need a highly accessible, keyboard navigable date range picker that fits the current design system.',
    amount: 800,
    tags: ['React', 'Radix UI', 'TypeScript'],
    difficulty: 'Intermediate',
    deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
    status: 'Open',
    creator: { username: 'shadcn', avatarUrl: 'https://picsum.photos/seed/ui/100', rating: 4.8 },
    requirements: ['Must support keyboard navigation', 'Mobile responsive', 'WAI-ARIA compliant']
  },
  {
    id: 'b4',
    repoOwner: 'solana-labs',
    repoName: 'solana',
    title: 'Optimize validator gossip protocol',
    description: 'Improve the efficiency of the gossip protocol to reduce bandwidth usage by 15% without compromising propagation time.',
    amount: 8500,
    tags: ['Rust', 'Networking', 'Blockchain'],
    difficulty: 'Advanced',
    deadline: new Date(Date.now() + 86400000 * 14).toISOString(),
    status: 'Open',
    creator: { username: 'toly', avatarUrl: 'https://picsum.photos/seed/sol/100', rating: 4.7 },
    requirements: ['Benchmark current implementation', 'Propose and implement optimization', 'Verify with local cluster']
  },
  {
    id: 'b5',
    repoOwner: 'novuhq',
    repoName: 'novu',
    title: 'Fix typo in documentation',
    description: 'Small typo in the getting started guide.',
    amount: 50,
    tags: ['Documentation'],
    difficulty: 'Beginner',
    deadline: new Date(Date.now() + 86400000 * 1).toISOString(),
    status: 'Open',
    creator: { username: 'scopsy', avatarUrl: 'https://picsum.photos/seed/novu/100', rating: 4.9 },
    requirements: ['Fix typo']
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', type: 'Earning', amount: 500, date: '2023-10-15', status: 'Pending', description: 'Bounty Reward: Fix nav bug' },
  { id: 't2', type: 'Withdrawal', amount: 2000, date: '2023-10-10', status: 'Completed', description: 'Withdrawal to External Wallet' },
  { id: 't3', type: 'Earning', amount: 1500, date: '2023-09-28', status: 'Completed', description: 'Bounty Reward: API integration' },
  { id: 't4', type: 'Earning', amount: 300, date: '2023-09-15', status: 'Failed', description: 'Bounty Reward: Doc update' },
  { id: 't5', type: 'Earning', amount: 750, date: '2023-09-10', status: 'Completed', description: 'Bounty Reward: Test coverage' },
  { id: 't6', type: 'Withdrawal', amount: 1000, date: '2023-09-05', status: 'Pending', description: 'Withdrawal to External Wallet' },
  { id: 't7', type: 'Earning', amount: 1200, date: '2023-08-28', status: 'Completed', description: 'Bounty Reward: Refactor legacy code' },
  { id: 't8', type: 'Earning', amount: 450, date: '2023-08-20', status: 'Completed', description: 'Bounty Reward: UI Polish' },
  { id: 't9', type: 'Withdrawal', amount: 3000, date: '2023-08-15', status: 'Failed', description: 'Withdrawal to External Wallet' },
  { id: 't10', type: 'Earning', amount: 2500, date: '2023-08-01', status: 'Completed', description: 'Bounty Reward: Core Algorithm Optimization' },
  { id: 't11', type: 'Earning', amount: 100, date: '2023-07-25', status: 'Completed', description: 'Bounty Reward: Fix typos' },
  { id: 't12', type: 'Earning', amount: 600, date: '2023-07-20', status: 'Completed', description: 'Bounty Reward: Add unit tests' },
  { id: 't13', type: 'Withdrawal', amount: 500, date: '2023-07-15', status: 'Completed', description: 'Withdrawal to External Wallet' },
  { id: 't14', type: 'Earning', amount: 900, date: '2023-07-10', status: 'Completed', description: 'Bounty Reward: Mobile responsive fix' },
  { id: 't15', type: 'Earning', amount: 350, date: '2023-07-05', status: 'Completed', description: 'Bounty Reward: Update dependencies' },
];