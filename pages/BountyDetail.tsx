import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Github, Calendar, Shield, Share2, CheckCircle2 } from 'lucide-react';
import { Button, Card, Badge } from '../components/Shared';
import { MOCK_BOUNTIES } from '../mockData';

export const BountyDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const bounty = MOCK_BOUNTIES.find(b => b.id === id);
  const [applying, setApplying] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Check if we should hide the apply button (e.g. user came from Submit Task page)
  const hideApply = (location.state as { hideApply?: boolean })?.hideApply;

  if (!bounty) return <div className="p-8 text-center">Bounty not found</div>;

  if (submitted) {
    return (
      <div className="min-h-[85vh] flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-300 p-6">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20 shadow-[0_0_30px_-10px_rgba(254,137,31,0.3)]">
          <CheckCircle2 size={42} strokeWidth={3} />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-white">Application Submitted!</h2>
          <p className="text-text-secondary max-w-xs mx-auto text-sm leading-relaxed">
            The bounty creator will review your application. You'll be notified once accepted.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs pt-6">
          <Button 
            variant="outline" 
            fullWidth 
            onClick={() => navigate('/tasks')}
            className="border-white/10 text-white hover:bg-white/5 hover:text-white hover:border-white/20"
          >
            View My Tasks
          </Button>
          <Button fullWidth onClick={() => navigate('/explorer')}>Explore More</Button>
        </div>
      </div>
    );
  }

  if (applying) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 p-5 pb-32">
        <div className="flex items-center gap-4">
          <button onClick={() => setApplying(false)} className="p-2 -ml-2 hover:bg-surface rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">Apply for Bounty</h2>
        </div>

        <div className="p-5 bg-surface border border-primary/30 rounded-xl shadow-[0_0_30px_-10px_rgba(254,137,31,0.1)]">
           <div className="text-xs text-text-secondary mb-1 font-bold tracking-wider">APPLYING FOR</div>
           <div className="font-semibold text-white text-lg">{bounty.title}</div>
           <div className="text-primary font-bold mt-2 text-xl">${bounty.amount.toLocaleString()} USDC</div>
        </div>

        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Cover Letter</label>
            <textarea 
              className="w-full bg-surface border border-border rounded-xl p-4 h-40 text-sm focus:border-primary focus:outline-none resize-none placeholder:text-white/20"
              placeholder="Explain why you're the best fit for this task..."
              defaultValue="I have extensive experience with this specific issue. I've contributed to similar repositories before and understand the reconciliation logic required."
            ></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">Estimated Completion</label>
            <div className="relative">
                <select className="w-full bg-surface border border-border rounded-xl p-4 text-sm focus:border-primary focus:outline-none appearance-none">
                <option>Less than 3 days</option>
                <option>3-7 Days</option>
                <option>1-2 Weeks</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">▼</div>
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium text-text-secondary">Relevant Links</label>
             <input type="text" placeholder="github.com/your-username" className="w-full bg-surface border border-border rounded-xl p-4 text-sm focus:border-primary focus:outline-none placeholder:text-white/20" />
          </div>

          <div className="pt-6 fixed bottom-0 left-0 right-0 p-5 bg-background border-t border-border z-20">
            <Button fullWidth size="lg">Submit Application</Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Sticky Navbar Actions */}
      <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl z-30 px-4 py-3 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-surface rounded-full text-text-secondary"><Share2 size={20} /></button>
        </div>
      </div>

      <div className={`p-5 space-y-6 ${hideApply ? 'pb-10' : 'pb-32'}`}>
        {/* Header Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-primary bg-primary/10 w-fit px-2.5 py-0.5 rounded-full text-xs font-medium border border-primary/20">
            <Github size={13} />
            {bounty.repoOwner}/{bounty.repoName}
          </div>
          
          <h1 className="text-xl font-bold leading-tight">{bounty.title}</h1>
          
          <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
             <div className="space-y-1">
               <div className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Bounty Amount</div>
               <div className="text-xl font-bold text-primary">${bounty.amount.toLocaleString()}</div>
             </div>
             <div className="text-right space-y-1">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Difficulty</div>
                <Badge variant={bounty.difficulty === 'Advanced' ? 'error' : 'warning'}>{bounty.difficulty}</Badge>
             </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {bounty.tags.map(tag => (
            <span key={tag} className="px-3 py-1.5 bg-surface rounded-full text-xs font-medium text-text-secondary border border-border">
              {tag}
            </span>
          ))}
        </div>

        {/* Creator */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-border/50">
          <img src={bounty.creator.avatarUrl} alt={bounty.creator.username} className="w-10 h-10 rounded-full" />
          <div className="flex-1">
            <div className="font-medium text-sm">@{bounty.creator.username}</div>
            <div className="text-xs text-text-secondary">Bounty Creator • {bounty.creator.rating} ★</div>
          </div>
        </div>

        {/* Tabs / Sections */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">Description</h3>
            <div className="text-text-secondary leading-relaxed text-sm space-y-4">
                <p>{bounty.description}</p>
                <p>Here is some additional context usually provided in the markdown. The developer must ensure that the fix passes all regression tests.</p>
                
                <div className="bg-[#111] p-4 rounded-lg font-mono text-xs border border-white/10 overflow-x-auto text-gray-300">
                <span className="text-purple-400">const</span> <span className="text-blue-400">bug</span> = <span className="text-yellow-400">await</span> reproduce(<span className="text-orange-400">true</span>);
                </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">Requirements</h3>
            <ul className="space-y-3">
                {bounty.requirements.map((req, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-secondary bg-surface/30 p-3 rounded-lg border border-white/5">
                    <Shield size={18} className="text-primary shrink-0 mt-0.5" />
                    <span>{req}</span>
                </li>
                ))}
            </ul>
          </div>
           
           <div className="flex gap-2 items-center text-xs text-text-secondary pt-4 justify-center opacity-70">
              <Calendar size={14} />
              <span>Deadline: {new Date(bounty.deadline).toLocaleDateString()}</span>
           </div>
        </div>
      </div>

      {/* Sticky Bottom CTA */}
      {!hideApply && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-background/80 backdrop-blur-xl border-t border-border z-20">
          <Button 
              variant="primary" 
              fullWidth 
              size="lg" 
              onClick={() => setApplying(true)}
              className="shadow-xl shadow-primary/20"
          >
              Apply for Bounty
          </Button>
        </div>
      )}
    </div>
  );
};