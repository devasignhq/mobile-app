import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, CheckCircle, AlertCircle, ArrowRight, Search, X, Github } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { Task } from '../types';

type Tab = 'Active' | 'Review' | 'Completed' | 'Rejected';

export const MyTasks: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize tab from navigation state if available, default to 'Active'
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const state = location.state as { initialTab?: Tab } | null;
    return state?.initialTab || 'Active';
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Use Context instead of local state
  const { tasks } = useTasks();

  const filteredTasks = tasks.filter(t => {
    const matchesTab = t.status === activeTab;
    if (!searchTerm) return matchesTab;
    const term = searchTerm.toLowerCase();
    return matchesTab && (
      t.title.toLowerCase().includes(term) || 
      t.repo.toLowerCase().includes(term)
    );
  });

  const handleTaskClick = (task: Task) => {
    if (task.status === 'Active') {
        navigate(`/task/active/${task.id}`);
    } else if (task.status === 'Review') {
        navigate(`/submission/${task.id}`);
    } else if (task.status === 'Completed') {
        navigate(`/task/completed/${task.id}`);
    }
  };

  return (
    <div className="min-h-full bg-background flex flex-col relative">
      {/* Header */}
      <div className="px-5 pt-7 pb-2 shrink-0 min-h-[60px] flex items-center">
        {isSearchOpen ? (
          <div className="flex-1 flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input 
                autoFocus
                type="text" 
                placeholder="Search tasks..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 placeholder:text-text-secondary/60 transition-colors"
              />
            </div>
            <button 
              onClick={() => {
                setIsSearchOpen(false);
                setSearchTerm('');
              }}
              className="p-2 bg-surface hover:bg-white/10 rounded-full text-text-secondary hover:text-white transition-colors border border-white/5"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full animate-in fade-in slide-in-from-left-2 duration-200">
            <h2 className="text-xl font-bold text-white">My Tasks</h2>
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2.5 -mr-2 text-white hover:bg-surface rounded-full transition-all active:scale-95"
            >
              <Search size={22} />
            </button>
          </div>
        )}
      </div>

      {/* Sticky Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-5 py-3 border-b border-white/5 shrink-0">
        <div className="flex p-1 bg-surface border border-border rounded-xl overflow-x-auto hide-scrollbar shadow-lg shadow-black/20">
          {(['Active', 'Review', 'Completed', 'Rejected'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-primary text-background shadow-lg font-bold' 
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab === 'Review' ? 'Review' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className={`px-5 py-4 space-y-4 pb-24 flex-1 ${filteredTasks.length === 0 ? 'flex flex-col items-center justify-center' : ''}`}>
        {filteredTasks.length > 0 ? (
          filteredTasks.map(task => (
            <div 
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className="bg-surface border border-white/5 rounded-2xl p-4 flex flex-col transition-all active:scale-[0.98] shadow-sm animate-in fade-in duration-300 cursor-pointer hover:bg-surface/80 group"
            >
              {/* Header Row */}
              <div className="mb-2 flex justify-between items-start">
                 <span className="text-xs font-bold text-text-secondary/60 font-mono tracking-tight flex items-center gap-1.5">
                    <Github size={12} /> {task.repo}
                 </span>
                 {task.status === 'Active' && (
                    <ArrowRight size={16} className="text-white/20 group-hover:text-primary transition-colors" />
                 )}
              </div>

              {/* Title */}
              <h3 className="font-bold text-base text-white leading-snug mb-3 pr-2">
                {task.title}
              </h3>

              {/* Footer Row */}
              <div className="flex justify-between items-center mt-auto">
                {/* Amount & Status/Deadline Badge */}
                <div className="flex items-center gap-3">
                  <span className="text-primary font-bold text-lg tracking-tight">${task.amount.toLocaleString()}</span>

                  {task.status === 'Active' && task.deadline && (
                    <div className="flex items-center gap-1.5 bg-[#F59E0B]/10 text-[#F59E0B] px-3 py-1.5 rounded-full border border-[#F59E0B]/20 text-xs font-medium">
                      <Clock size={13} className="stroke-[2.5]" />
                      <span>{task.deadline}</span>
                    </div>
                  )}
                  {task.status === 'Completed' && (
                    <div className="flex items-center gap-1.5 bg-success/10 text-success px-3 py-1.5 rounded-full border border-success/20 text-xs font-medium">
                      <CheckCircle size={13} className="stroke-[2.5]" />
                      <span>Paid</span>
                    </div>
                  )}
                  {task.status === 'Review' && (
                    <div className="flex items-center gap-1.5 bg-white/5 text-text-secondary px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium">
                      <AlertCircle size={13} className="stroke-[2.5]" />
                      <span>In Review</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center flex flex-col items-center text-text-secondary opacity-50 -mt-12">
            {searchTerm ? (
               <>
                 <Search size={48} className="mb-4 stroke-1 opacity-50" />
                 <p>No tasks match "{searchTerm}"</p>
               </>
            ) : (
               <>
                 <CheckCircle size={48} className="mb-4 stroke-1" />
                 <p>No tasks in this status</p>
               </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};