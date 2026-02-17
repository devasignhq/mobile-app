import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface NotificationItem {
  id: string;
  type: 'match' | 'merge' | 'withdrawal' | 'comment' | 'system';
  title: string;
  description: ReactNode;
  time: string;
  isUnread?: boolean;
  details: string;
  actionLink?: string;
  actionLabel?: string;
  isInternal?: boolean;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  markAsRead: (id: string) => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      type: 'match',
      title: 'New Match: Solana Audit',
      description: <span className="text-text-secondary"><span className="text-white font-bold">500 USDC</span> bounty matches your Rust profile skills.</span>,
      time: '2m',
      isUnread: true,
      details: "Based on your verified Rust and Smart Contract skills, you've been matched with a new high-priority bounty. The Solana Foundation is looking for an audit on their new SPL token extension. This is a time-sensitive task with a high reward.",
      actionLabel: "View Task",
      actionLink: "/bounty/b4",
      isInternal: true
    },
    {
      id: '2',
      type: 'merge',
      title: 'PR #402 Merged',
      description: <span className="text-text-secondary">Payment pending for 'Fix API Rate Limit'</span>,
      time: '1h',
      isUnread: true,
      details: "Congratulations! Your Pull Request #402 addressing the API Rate Limit issues has been reviewed and merged by the maintainer. The bounty reward of 1,200 USDC has been released to escrow and will be available in your wallet after the 24h dispute period.",
      actionLabel: "View Pull Request",
      actionLink: "https://github.com/facebook/react/pull/402"
    },
    {
      id: '3',
      type: 'withdrawal',
      title: 'Withdrawal Confirmed',
      description: <span className="text-text-secondary"><span className="text-white">1,200 USDC</span> sent to 0x8f...2a</span>,
      time: 'Yesterday',
      isUnread: false,
      details: "Your withdrawal request has been successfully processed on the Ethereum network. 1,200 USDC has been transferred to your connected wallet address 0x8f...2a. You can view the transaction on Etherscan.",
      actionLabel: "View on Etherscan",
      actionLink: "https://etherscan.io/tx/0x59a58b29c54096053f568600863071253c15372439366f85108253686868686"
    },
    {
      id: '4',
      type: 'comment',
      title: 'New Comment',
      description: <span className="text-text-secondary">Maintainer replied on 'Optimism Integration'</span>,
      time: '2d ago',
      isUnread: false,
      details: "The maintainer @optimism_lead has replied to your question regarding the Optimism Bedrock migration: 'Yes, please ensure all L2 calls are batched properly according to the new spec. Thanks!'",
      actionLabel: "View Discussion",
      actionLink: "https://github.com/ethereum-optimism/optimism/issues/123"
    },
    {
      id: '5',
      type: 'system',
      title: 'System Maintenance',
      description: <span className="text-text-secondary">Scheduled downtime completed successfully.</span>,
      time: 'Last week',
      isUnread: false,
      details: "The scheduled maintenance for our database clusters has been completed successfully. All systems are back online and operating at normal capacity. No action is required on your part."
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, isUnread: false } : n
    ));
  };

  const unreadCount = notifications.filter(n => n.isUnread).length;

  return (
    <NotificationContext.Provider value={{ notifications, markAsRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};