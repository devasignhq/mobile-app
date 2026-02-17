import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Task } from '../types';

interface TaskContextType {
  tasks: Task[];
  updateTaskStatus: (taskId: string, status: string, additionalData?: Partial<Task>) => void;
  getTask: (taskId: string) => Task | undefined;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 't1',
      title: 'Fix concurrent mode rendering edge case',
      amount: 5000,
      status: 'Active',
      deadline: '2 days left',
      repo: 'facebook/react'
    },
    {
      id: 't2',
      title: 'Optimize validator gossip protocol',
      amount: 8500,
      status: 'Review',
      submittedAt: 'Yesterday',
      repo: 'solana-labs/solana'
    },
    {
      id: 't3',
      title: 'Fix typo in documentation',
      amount: 50,
      status: 'Completed',
      completedAt: 'Oct 15, 2023',
      repo: 'novuhq/novu'
    }
  ]);

  const updateTaskStatus = (taskId: string, status: string, additionalData?: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status, ...additionalData } 
        : task
    ));
  };

  const getTask = (taskId: string) => {
    return tasks.find(t => t.id === taskId);
  };

  return (
    <TaskContext.Provider value={{ tasks, updateTaskStatus, getTask }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};