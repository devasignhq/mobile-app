import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Github, ExternalLink, FileText, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../components/Shared';
import { useTasks } from '../contexts/TaskContext';

export const ViewSubmission: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getTask } = useTasks();
  const task = getTask(taskId || '');

  if (!task) {
     return (
        <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle size={48} className="text-error mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Task Not Found</h2>
            <Button onClick={() => navigate('/tasks')}>Back to Tasks</Button>
        </div>
     );
  }

  // Mock submission data for display
  const submissionData = {
    prUrl: `https://github.com/${task.repo}/pull/402`,
    attachmentUrl: 'https://notion.so/devasign/docs/123',
    files: [
        { name: 'implementation_notes.md', size: '12 KB' },
        { name: 'test_coverage_report.pdf', size: '245 KB' }
    ],
    submittedAt: task.submittedAt || '2 hours ago',
    status: task.status
  };

  return (
    <div className="h-screen bg-background text-white flex flex-col overflow-y-auto hide-scrollbar">
       {/* Header */}
       <div className="shrink-0 bg-background/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
        <button 
          onClick={() => navigate('/tasks', { state: { initialTab: 'Review' } })} 
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Submission Details</h1>
      </div>

      <div className="p-5 pb-24 max-w-2xl mx-auto w-full space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        {/* Status Card */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center space-y-3 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
             
             <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1 border border-primary/20 shadow-[0_0_20px_-5px_rgba(254,137,31,0.3)]">
                <Clock size={32} strokeWidth={2.5} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white">Under Review</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] bg-white/5 text-text-secondary px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider font-bold">
                        Submitted {submissionData.submittedAt}
                    </span>
                </div>
             </div>
             <p className="text-text-secondary text-xs leading-relaxed max-w-sm">
                The bounty creator is reviewing your work. You will be notified once a decision is made or if changes are requested.
             </p>
        </div>

        {/* Submission Content */}
        <div className="space-y-5">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">Submitted Work</h3>
                <span className="text-[10px] text-text-secondary">ID: #SUB-8924</span>
             </div>
             
             {/* PR Link */}
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

             {/* Attachment Link */}
             <div className="space-y-1.5">
                <label className="text-xs text-text-secondary ml-1">Additional Resources</label>
                <a href={submissionData.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between bg-surface border border-white/10 p-3 rounded-lg hover:bg-white/5 hover:border-primary/30 transition-all group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={18} className="text-white shrink-0" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wide leading-tight">External Link</span>
                            <span className="text-xs font-mono text-primary truncate underline decoration-primary/30 underline-offset-2 group-hover:decoration-primary">
                                {submissionData.attachmentUrl}
                            </span>
                        </div>
                    </div>
                    <ExternalLink size={14} className="text-text-secondary group-hover:text-white transition-colors shrink-0" />
                </a>
             </div>

             {/* Files */}
             <div className="space-y-1.5">
                <label className="text-xs text-text-secondary ml-1">Uploaded Files</label>
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
        </div>
        
        <div className="pt-4">
             <Button fullWidth variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/50">
                Withdraw Submission
            </Button>
            <p className="text-[10px] text-text-secondary text-center mt-3">
                Withdrawing will cancel your submission and remove it from the review queue.
            </p>
        </div>
      </div>
    </div>
  );
};