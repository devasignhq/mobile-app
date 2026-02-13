import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, Clock, CalendarPlus, MessageSquare, UploadCloud, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '../components/Shared';
import { useTasks } from '../contexts/TaskContext';
import { MOCK_BOUNTIES } from '../mockData';
import { theme } from '../styles/theme';

export const ActiveTaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getTask } = useTasks();
  const task = getTask(taskId || '');

  const [showExtensionSheet, setShowExtensionSheet] = useState(false);
  const [extensionDays, setExtensionDays] = useState('3');
  const [extensionReason, setExtensionReason] = useState('');

  if (!task) {
    return (
        <div className={theme.layout.centeredPage}>
            <AlertCircle size={48} className="text-error mb-4" />
            <h2 className={theme.typography.h2 + " mb-2"}>Task Not Found</h2>
            <Button onClick={() => navigate('/tasks')}>Back to Tasks</Button>
        </div>
    );
  }

  // Find associated bounty for details
  const bounty = MOCK_BOUNTIES.find(b => b.title.includes(task.title) || task.title.includes(b.title));

  const handleExtensionSubmit = () => {
    setShowExtensionSheet(false);
    setExtensionReason('');
    setExtensionDays('3');
    alert("Extension request sent to maintainer.");
  };

  return (
    <div className={theme.layout.page}>
       {/* Header */}
       <div className={theme.layout.header}>
        <button 
          onClick={() => navigate('/tasks')} 
          className={theme.components.backButton}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className={theme.layout.headerTitle}>Task Details</h1>
      </div>

      <div className={theme.layout.scrollableContent}>
           {/* Header Info */}
           <div className={theme.layout.section}>
                <div className={theme.layout.rowBetween}>
                    <div className={`flex items-center gap-2 ${theme.components.badge.primary} rounded-full px-2.5 py-1`}>
                        <Github size={12} />
                        {task.repo}
                    </div>
                    {task.deadline && (
                        <div className={`flex items-center gap-1.5 ${theme.components.badge.warning} rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider`}>
                            <Clock size={12} className="stroke-[2.5]" />
                            {task.deadline}
                        </div>
                    )}
                </div>
                
                <h2 className={theme.typography.h3 + " leading-tight"}>{task.title}</h2>
                
                <div className={theme.components.card + " flex items-center justify-between"}>
                    <div>
                       <div className={theme.typography.captionLabel + " mb-0.5"}>Total Bounty</div>
                       <div className="text-2xl font-bold text-primary tracking-tight">${task.amount.toLocaleString()} <span className="text-sm font-medium text-primary/60">USDC</span></div>
                    </div>
                    {bounty?.creator && (
                       <div className="flex flex-col items-end">
                          <div className={theme.typography.captionLabel + " mb-1"}>Creator</div>
                          <div className={theme.layout.rowCenter}>
                             <span className={theme.typography.bodyHighlight}>{bounty.creator.username}</span>
                             <img 
                                src={bounty.creator.avatarUrl} 
                                className="w-6 h-6 rounded-full border border-white/20" 
                                alt="Creator"
                             />
                          </div>
                       </div>
                    )}
                </div>
                
                {bounty && (
                    <div className="text-sm text-text-secondary leading-relaxed bg-surface/30 p-4 rounded-xl border border-white/5 space-y-4">
                        <div>
                            <h4 className={theme.typography.label + " mb-2 ml-0"}>Description</h4>
                            <p className="leading-relaxed">{bounty.description}</p>
                        </div>
                        {bounty.requirements && (
                            <div>
                                <h4 className={theme.typography.label + " mb-2 ml-0"}>Requirements</h4>
                                <ul className="space-y-2">
                                    {bounty.requirements.map((req, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span className="text-primary mt-1">•</span>
                                            <span>{req}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
           </div>
      </div>

      {/* Action Buttons Fixed at Bottom */}
      <div className={theme.layout.fixedBottom}>
            <div className="grid grid-cols-2 gap-3">
                <Button 
                    variant="outline" 
                    className="border-white/10 text-white hover:bg-white/5 gap-2 h-12"
                    onClick={() => setShowExtensionSheet(true)}
                >
                    <CalendarPlus size={18} />
                    Extend Timeline
                </Button>
                <Button 
                    variant="outline" 
                    className="border-white/10 text-white hover:bg-white/5 gap-2 h-12"
                    onClick={() => navigate('/messages/c1')}
                >
                    <MessageSquare size={18} />
                    Message Creator
                </Button>
            </div>
            
            <Button 
                fullWidth 
                size="lg" 
                onClick={() => navigate(`/submit/${task.id}`)}
                className="shadow-xl shadow-primary/20 h-14 text-base font-bold gap-2"
            >
                <UploadCloud size={20} />
                Submit Task
            </Button>
      </div>

      {/* Extension Request Bottom Sheet */}
      {showExtensionSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
            {/* Backdrop */}
            <div 
              className={theme.ui.backdrop}
              onClick={() => setShowExtensionSheet(false)}
            ></div>
            
            {/* Sheet */}
            <div className={theme.ui.bottomSheet}>
               <div className={theme.ui.handleBar}></div>
               
               <h2 className={theme.typography.h2 + " mb-2"}>Request Extension</h2>
               <p className={theme.typography.body + " mb-6"}>Need more time? Propose a new deadline to the maintainer.</p>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                     <label className={theme.typography.label}>Additional Time</label>
                     <div className="relative">
                        <select 
                           value={extensionDays}
                           onChange={(e) => setExtensionDays(e.target.value)}
                           className={theme.components.select}
                        >
                           <option value="1">1 Day</option>
                           <option value="3">3 Days</option>
                           <option value="7">1 Week</option>
                           <option value="14">2 Weeks</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={18} />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className={theme.typography.label}>Reason</label>
                     <textarea 
                        value={extensionReason}
                        onChange={(e) => setExtensionReason(e.target.value)}
                        placeholder="Explain why you need more time..."
                        className={theme.components.textarea + " min-h-[120px]"}
                     />
                  </div>
                  
                  <div className="pt-4 grid grid-cols-2 gap-3">
                     <Button 
                        variant="ghost" 
                        size="lg"
                        onClick={() => setShowExtensionSheet(false)}
                        className="bg-white/5 hover:bg-white/10 text-white"
                     >
                        Cancel
                     </Button>
                     <Button 
                        size="lg"
                        onClick={handleExtensionSubmit}
                        disabled={!extensionReason.trim()}
                        className="bg-primary text-background shadow-lg shadow-primary/20"
                     >
                        Submit Request
                     </Button>
                  </div>
               </div>
            </div>
        </div>
      )}
    </div>
  );
};