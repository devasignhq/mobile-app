import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, X, FileText, CheckCircle2, Github, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Button } from '../components/Shared';
import { useTasks } from '../contexts/TaskContext';
import { MOCK_BOUNTIES } from '../mockData';

export const SubmitTask: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getTask, updateTaskStatus } = useTasks();
  const task = getTask(taskId || '');
  
  const [prUrl, setPrUrl] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!task) {
    return (
        <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle size={48} className="text-error mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Task Not Found</h2>
            <Button onClick={() => navigate('/tasks')}>Back to Tasks</Button>
        </div>
    );
  }

  // Find associated bounty to link to details
  const bounty = MOCK_BOUNTIES.find(b => b.title.includes(task.title) || task.title.includes(b.title));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prUrl) return;

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
        updateTaskStatus(task.id, 'Review', { submittedAt: 'Just now' });
        setIsSubmitting(false);
        setShowSuccess(true);
    }, 1500);
  };

  return (
    <div className="h-screen bg-background text-white flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-4 z-30">
        <button 
          onClick={() => navigate('/tasks')} 
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Submit Task</h1>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-5 pb-24 max-w-2xl mx-auto w-full">
        
        {/* Task Summary Card - Clickable to view details */}
        <div 
            onClick={() => bounty && navigate(`/bounty/${bounty.id}`, { state: { hideApply: true } })}
            className="bg-surface/30 border border-primary/20 rounded-xl p-5 mb-8 relative overflow-hidden cursor-pointer hover:bg-surface/50 transition-all group active:scale-[0.99]"
        >
             <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
             
             <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight size={16} className="text-primary" />
             </div>

             <h3 className="font-bold text-white text-base mb-3 pr-6 leading-snug group-hover:text-primary transition-colors">
                {task.title}
             </h3>
             <div className="flex items-center justify-between">
                <span className="text-[10px] bg-[#3E2C18] text-[#DFA46D] px-2.5 py-1 rounded border border-[#DFA46D]/20 uppercase tracking-wide font-medium">
                   enhancement
                </span>
                <div className="flex items-center gap-2 text-text-secondary text-xs">
                   <Github size={14} />
                   <span className="font-medium font-mono">{task.repo}</span>
                </div>
             </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
             {/* Anti-fingerprinting Notice */}
             <div className="p-4 rounded-lg bg-surface border border-dashed border-white/10 text-xs text-text-secondary">
                 <span className="text-white font-bold block mb-1">Privacy Notice</span>
                 Ensure you remove any personal identifiers from uploaded documents to avoid bot detection fingerprints.
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1 flex gap-1">
                   Pull Request URL <span className="text-primary">*</span>
                </label>
                <input 
                   type="url" 
                   required
                   placeholder="https://github.com/..." 
                   value={prUrl}
                   onChange={(e) => setPrUrl(e.target.value)}
                   className="w-full bg-surface border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-secondary/50 font-mono transition-colors"
                />
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">
                   Attachment URL (Optional)
                </label>
                <input 
                   type="url" 
                   placeholder="https://notion.so/..." 
                   value={attachmentUrl}
                   onChange={(e) => setAttachmentUrl(e.target.value)}
                   className="w-full bg-surface border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary focus:outline-none placeholder:text-text-secondary/50 font-mono transition-colors"
                />
                <p className="text-[10px] text-text-secondary/60 leading-relaxed px-1">
                   Link to documentation, demo videos, or external resources.
                </p>
             </div>

             <div className="space-y-3">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">
                   Upload Documents
                </label>
                
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 hover:border-primary/50 bg-surface hover:bg-surface/80 transition-all rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer group"
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        onChange={handleFileChange}
                    />
                    <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <UploadCloud size={20} className="text-text-secondary group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs font-medium text-white mb-0.5">Click to upload or drag and drop</p>
                    <p className="text-[10px] text-text-secondary">PDF, DOCX, TXT, or Code files (max 10MB)</p>
                </div>

                {/* File List */}
                {files.length > 0 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-surface border border-white/5 rounded-lg">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText size={18} className="text-primary shrink-0" />
                                    <span className="text-sm text-white truncate">{file.name}</span>
                                    <span className="text-xs text-text-secondary shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => removeFile(idx)}
                                    className="p-1.5 hover:bg-white/10 rounded-md text-text-secondary hover:text-error transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
             </div>

             <div className="pt-8 pb-8">
                <Button 
                   fullWidth 
                   size="lg" 
                   className="flex items-center justify-center gap-2 font-bold bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20 h-14 text-lg"
                   disabled={isSubmitting || !prUrl}
                >
                   {isSubmitting ? 'Submitting...' : 'Submit Task'} 
                   {!isSubmitting && <ArrowUpRight size={22} strokeWidth={2.5} />}
                </Button>
             </div>
        </form>
      </div>

      {/* Success Modal */}
      {showSuccess && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"></div>
            <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 text-center">
               <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]">
                  <CheckCircle2 size={40} className="text-green-500" strokeWidth={2.5} />
               </div>
               
               <h3 className="text-2xl font-bold text-white mb-2">Review in Progress</h3>
               <p className="text-text-secondary text-sm leading-relaxed mb-8">
                  Your submission has been received. The bounty creator will review your work shortly.
               </p>
               
               <Button 
                 fullWidth 
                 onClick={() => navigate('/tasks')}
                 variant="outline"
                 className="border-white/10 text-white hover:bg-white/5"
               >
                 Okay, got it
               </Button>
            </div>
         </div>
      )}
    </div>
  );
};