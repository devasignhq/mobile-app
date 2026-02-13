import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Zap, Code, Settings, ExternalLink, LogOut } from 'lucide-react';
import { Card, Badge, Button } from '../components/Shared';
import { CURRENT_USER } from '../mockData';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/');
  };

  return (
    <div className="min-h-full bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 flex justify-between items-center px-5 py-4 bg-background/95 backdrop-blur-xl border-b border-white/5">
         <h2 className="text-xl font-bold text-white">Profile</h2>
         <button 
           onClick={() => navigate('/settings')}
           className="p-2.5 hover:bg-surface rounded-full text-text-secondary border border-transparent hover:border-white/10 transition-colors"
         >
            <Settings size={22} />
         </button>
      </div>

      {/* Content */}
      <div className="px-5 pb-24 space-y-6">
        {/* Profile Header */}
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <img src={CURRENT_USER.avatarUrl} alt="Profile" className="w-20 h-20 rounded-full border-4 border-surface shadow-2xl" />
            <div className="absolute bottom-0 right-0 bg-primary w-7 h-7 rounded-full border-4 border-background flex items-center justify-center">
              <Zap size={12} className="text-black fill-black" />
            </div>
          </div>
          <h3 className="mt-4 text-2xl font-bold">{CURRENT_USER.username}</h3>
          <a href="#" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mt-1 px-3 py-1 rounded-full bg-surface/50 border border-white/5">
            github.com/{CURRENT_USER.username} <ExternalLink size={12} />
          </a>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-3 px-2 bg-gradient-to-br from-surface to-surface/50">
            <div className="text-xl font-bold text-primary">{CURRENT_USER.bountiesCompleted}</div>
            <div className="text-[10px] uppercase text-text-secondary font-bold mt-1 tracking-wider">Bounties</div>
          </Card>
          <Card className="text-center py-3 px-2 bg-gradient-to-br from-surface to-surface/50">
            <div className="text-xl font-bold text-white">${(CURRENT_USER.totalEarned / 1000).toFixed(1)}k</div>
            <div className="text-[10px] uppercase text-text-secondary font-bold mt-1 tracking-wider">Earned</div>
          </Card>
          <Card className="text-center py-3 px-2 bg-gradient-to-br from-surface to-surface/50">
            <div className="text-xl font-bold text-success">{CURRENT_USER.successRate}%</div>
            <div className="text-[10px] uppercase text-text-secondary font-bold mt-1 tracking-wider">Success</div>
          </Card>
        </div>

        {/* Tech Stack */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider pl-1">Verified Tech Stack</h4>
          <div className="flex flex-wrap gap-2">
            {CURRENT_USER.techStack.map(tech => (
              <Badge key={tech} variant="outline" className="text-sm py-1.5 px-3 bg-surface border-border">
                <Code size={14} className="mr-2 inline" /> {tech}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-text-secondary mt-2 px-1">
            Auto-detected from your GitHub repositories.
            <button className="text-primary ml-1 hover:underline">Refresh</button>
          </p>
        </div>

        {/* Recent Activity Mock */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider pl-1">Achievements</h4>
           {/* SOC2 Style Badge */}
           <div className="inline-flex items-center bg-black border border-white/10 rounded-lg p-1.5 pr-4 gap-3 hover:border-yellow-500/50 transition-colors shadow-sm cursor-default group">
              <div className="w-9 h-9 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded flex items-center justify-center text-black shadow-inner group-hover:scale-105 transition-transform">
                  <Award size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-widest leading-none mb-0.5">Verified</span>
                  <span className="text-xs font-bold text-white leading-tight">Early Adopter</span>
              </div>
           </div>
        </div>
        
         <div className="pt-8">
          <Button 
            variant="outline" 
            fullWidth 
            className="text-error border-error/30 hover:bg-error/10 hover:border-error/50"
            onClick={() => setShowLogoutConfirm(true)}
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowLogoutConfirm(false)}
          ></div>
          <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error border border-error/20">
                <LogOut size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Sign Out</h3>
                <p className="text-sm text-text-secondary mt-1 px-4">
                  Are you sure you want to sign out of your account?
                </p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <Button 
                  variant="ghost" 
                  fullWidth 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="bg-white/5 hover:bg-white/10 text-white"
                >
                  Cancel
                </Button>
                <Button 
                  fullWidth 
                  onClick={handleLogout}
                  className="bg-error hover:bg-error/90 text-white shadow-lg shadow-error/20"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};