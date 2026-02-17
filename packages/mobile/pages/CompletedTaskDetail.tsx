import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, ExternalLink, FileText, CheckCircle2 } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { MOCK_BOUNTIES } from '../mockData';

export const CompletedTaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getTask } = useTasks();
  const task = getTask(taskId || '');

  if (!task) {
     return <div className="p-5 text-white">Task not found</div>;
  }

  // Find corresponding bounty details
  // In a real app, task would have bountyId
  const bounty = MOCK_BOUNTIES.find(b => b.title === task.title) || MOCK_BOUNTIES[4];

  // Mock submission data
  const submissionData = {
    prUrl: `https://github.com/${task.repo}/pull/402`,
    files: [
        { name: 'fix_typo.patch', size: '2 KB' },
        { name: 'screenshot.png', size: '150 KB' }
    ],
    completedAt: task.completedAt || 'Oct 15, 2023',
  };

  return (
    <div className="h-screen bg-background text-white overflow-y-auto hide-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-4">
        <button 
          onClick={() => navigate('/tasks', { state: { initialTab: 'Completed' } })} 
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Completed Task</h1>
      </div>

      <div className="p-5 space-y-6 animate-in slide-in-from-right duration-300 pb-24">
        
        {/* Paid Status & Amount */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-900/10 border border-green-500/20 rounded-2xl p-6 flex flex-col items-center text-center space-y-2 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>
             
             <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 mb-2 border border-green-500/30 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]">
                <CheckCircle2 size={28} strokeWidth={3} />
             </div>
             
             <h2 className="text-2xl font-bold text-white tracking-tight">
                ${task.amount.toLocaleString()} <span className="text-lg text-green-400 font-medium">USDC</span>
             </h2>
             
             <div className="inline-flex items-center gap-1.5 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Paid & Completed</span>
             </div>
             
             <p className="text-xs text-text-secondary mt-1">
                Funds released on {submissionData.completedAt}
             </p>
        </div>

        {/* Task Info */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Task Details</h3>
            <div className="bg-surface border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 w-fit px-2.5 py-1 rounded-full border border-primary/20">
                        <Github size={12} />
                        {task.repo}
                    </div>
                    <span className="text-[10px] font-mono text-text-secondary">#ID-{task.id.toUpperCase()}</span>
                </div>
                
                <div>
                    <h2 className="text-lg font-bold text-white leading-snug mb-2">{task.title}</h2>
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {bounty.description}
                    </p>
                </div>
            </div>
        </div>

        {/* Requirements */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Submission Requirements</h3>
            <div className="space-y-2">
                {bounty.requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-text-secondary bg-surface/30 p-3 rounded-lg border border-white/5">
                        <CheckCircle2 size={18} className="text-green-500/50 shrink-0" />
                        <span className="text-gray-300">{req}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Submission Artifacts */}
        <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest pl-1">Submitted Artifacts</h3>
            
            {/* PR Link Widget */}
            <div className="space-y-1.5">
                <label className="text-xs text-text-secondary ml-1">Pull Request</label>
                <a href={submissionData.prUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between bg-surface border border-white/10 p-3 rounded-lg hover:bg-white/5 hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Github size={18} className="text-white shrink-0" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wide leading-tight">GitHub PR</span>
                            <span className="text-xs font-mono text-primary truncate underline decoration-primary/30 underline-offset-2 group-hover:decoration-primary">
                                {submissionData.prUrl}
                            </span>
                        </div>
                    </div>
                    <ExternalLink size={14} className="text-text-secondary group-hover:text-white transition-colors shrink-0" />
                </a>
            </div>

            {/* Files Widget */}
            {submissionData.files.length > 0 && (
                <div className="space-y-1.5">
                    <label className="text-xs text-text-secondary ml-1">Documents</label>
                    <div className="space-y-2">
                        {submissionData.files.map((file, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-surface border border-white/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileText size={18} className="text-primary" />
                                    <span className="text-sm text-white">{file.name}</span>
                                </div>
                                <span className="text-xs text-text-secondary font-mono">{file.size}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};