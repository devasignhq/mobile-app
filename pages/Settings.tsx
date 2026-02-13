import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Bell, 
  Shield, 
  Moon, 
  Globe, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Upload, 
  Smartphone, 
  Mail,
  UserCheck,
  CreditCard
} from 'lucide-react';
import { Button, Card } from '../components/Shared';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  
  // Mock State
  const [kycStatus, setKycStatus] = useState<'unverified' | 'pending' | 'verified'>('unverified');
  const [showKycModal, setShowKycModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1: Warning, 2: Final Confirm
  
  // Preferences State
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowKycModal(false);
    setKycStatus('pending');
    // Simulate verification after 3 seconds
    setTimeout(() => setKycStatus('verified'), 5000);
  };

  const handleDeleteAccount = () => {
    // Simulate API call
    setTimeout(() => {
      navigate('/');
    }, 1000);
  };

  return (
    <div className="min-h-full bg-background pb-20 animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="p-5 space-y-8">
        
        {/* Section: Identity & KYC */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">Identity Verification</h2>
          <Card className={`p-0 overflow-hidden border ${
             kycStatus === 'verified' ? 'border-green-500/20' : 
             kycStatus === 'pending' ? 'border-yellow-500/20' : 'border-white/5'
          }`}>
            <div className="p-4 flex items-center gap-4">
               <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  kycStatus === 'verified' ? 'bg-green-500/10 text-green-500' :
                  kycStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-white/5 text-text-secondary'
               }`}>
                  {kycStatus === 'verified' ? <CheckCircle2 size={24} /> : 
                   kycStatus === 'pending' ? <UserCheck size={24} className="animate-pulse" /> : 
                   <Shield size={24} />}
               </div>
               <div className="flex-1">
                  <h3 className="font-bold text-white text-base">
                    {kycStatus === 'verified' ? 'Identity Verified' : 
                     kycStatus === 'pending' ? 'Verification in Progress' : 'Verify Your Identity'}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {kycStatus === 'verified' ? 'You have full access to withdrawals.' : 
                     kycStatus === 'pending' ? 'We are reviewing your documents.' : 'Required for withdrawals over $500.'}
                  </p>
               </div>
               {kycStatus === 'unverified' && (
                 <Button size="sm" onClick={() => setShowKycModal(true)}>Verify</Button>
               )}
            </div>
            {kycStatus === 'unverified' && (
               <div className="bg-white/5 px-4 py-2 text-[10px] text-text-secondary flex items-center gap-2">
                 <AlertTriangle size={12} className="text-warning" />
                 <span>Higher limits unlocked after verification.</span>
               </div>
            )}
          </Card>
        </section>

        {/* Section: Preferences */}
        <section className="space-y-3">
           <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">App Preferences</h2>
           <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
              
              {/* Notifications */}
              <div className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                       <Bell size={18} />
                    </div>
                    <div>
                       <div className="text-sm font-medium text-white">Push Notifications</div>
                       <div className="text-xs text-text-secondary">Bounty updates & rewards</div>
                    </div>
                 </div>
                 <Toggle checked={pushEnabled} onChange={setPushEnabled} />
              </div>

              {/* Email */}
              <div className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                       <Mail size={18} />
                    </div>
                    <div>
                       <div className="text-sm font-medium text-white">Email Digest</div>
                       <div className="text-xs text-text-secondary">Weekly summary</div>
                    </div>
                 </div>
                 <Toggle checked={emailEnabled} onChange={setEmailEnabled} />
              </div>

              {/* Currency */}
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 text-green-400 rounded-lg">
                       <Globe size={18} />
                    </div>
                    <div>
                       <div className="text-sm font-medium text-white">Currency</div>
                       <div className="text-xs text-text-secondary">USDC (USD Pegged)</div>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 text-text-secondary">
                    <span className="text-xs">USD</span>
                    <ChevronRight size={16} />
                 </div>
              </div>

              {/* Theme */}
              <div className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg">
                       <Moon size={18} />
                    </div>
                    <div>
                       <div className="text-sm font-medium text-white">Dark Mode</div>
                       <div className="text-xs text-text-secondary">Always on</div>
                    </div>
                 </div>
                 <div className="text-xs font-bold text-text-secondary bg-white/5 px-2 py-1 rounded">Default</div>
              </div>
           </div>
        </section>

        {/* Section: Security */}
        <section className="space-y-3">
           <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest px-1">Security</h2>
           <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
              
              {/* 2FA */}
              <div className="p-4 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                       <Smartphone size={18} />
                    </div>
                    <div>
                       <div className="text-sm font-medium text-white">2-Factor Auth</div>
                       <div className="text-xs text-text-secondary">Secure withdrawals</div>
                    </div>
                 </div>
                 <Toggle checked={twoFactorEnabled} onChange={setTwoFactorEnabled} />
              </div>
           </div>
        </section>

        {/* Section: Danger Zone */}
        <section className="space-y-3 pt-4">
           <Button 
             variant="outline" 
             fullWidth 
             className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 justify-start px-4 h-12"
             onClick={() => setShowDeleteModal(true)}
           >
              <Trash2 size={18} className="mr-3" />
              Delete Account
           </Button>
           <p className="text-[10px] text-text-secondary px-1 text-center">
             Version 1.0.4 • Build 20231025
           </p>
        </section>

      </div>

      {/* KYC Modal */}
      {showKycModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowKycModal(false)}></div>
           <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom">
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>
              
              <h2 className="text-xl font-bold text-white mb-2">Verify Identity</h2>
              <p className="text-sm text-text-secondary mb-6">Upload a valid government ID to unlock higher withdrawal limits.</p>

              <form onSubmit={handleKycSubmit} className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">Full Name</label>
                    <input type="text" className="w-full bg-surface border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-primary focus:outline-none" placeholder="Legal Name" required />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-1">Document Type</label>
                    <select className="w-full bg-surface border border-white/10 rounded-xl p-3.5 text-sm text-white focus:border-primary focus:outline-none">
                       <option>Passport</option>
                       <option>Driver's License</option>
                       <option>National ID</option>
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="border border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/5 cursor-pointer transition-colors h-32">
                       <CreditCard size={24} className="text-text-secondary" />
                       <span className="text-xs text-text-secondary">Front of ID</span>
                    </div>
                    <div className="border border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/5 cursor-pointer transition-colors h-32">
                       <Upload size={24} className="text-text-secondary" />
                       <span className="text-xs text-text-secondary">Back of ID</span>
                    </div>
                 </div>

                 <div className="pt-4">
                    <Button fullWidth size="lg">Submit for Review</Button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowDeleteModal(false)}></div>
           <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
              {deleteStep === 1 ? (
                 <div className="text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 mx-auto">
                       <AlertTriangle size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-white">Delete Account?</h3>
                       <p className="text-sm text-text-secondary mt-2 px-2">
                          This action is permanent. You will lose access to all your earnings, history, and active bounties.
                       </p>
                    </div>
                    <div className="flex flex-col gap-3 pt-2">
                       <Button variant="ghost" fullWidth onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                       <Button 
                          fullWidth 
                          className="bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-900/20"
                          onClick={() => setDeleteStep(2)}
                       >
                          I Understand, Continue
                       </Button>
                    </div>
                 </div>
              ) : (
                 <div className="text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 mx-auto">
                       <Trash2 size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-white">Final Confirmation</h3>
                       <p className="text-sm text-text-secondary mt-2 px-2">
                          Type <span className="text-white font-mono font-bold">DELETE</span> to confirm account deletion.
                       </p>
                       <input 
                         type="text" 
                         className="mt-4 w-full bg-surface border border-red-500/30 rounded-lg p-2 text-center text-white focus:outline-none focus:border-red-500" 
                         placeholder="DELETE"
                       />
                    </div>
                    <div className="flex gap-3 pt-2">
                       <Button variant="ghost" fullWidth onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                       <Button 
                          fullWidth 
                          className="bg-red-500 hover:bg-red-600 text-white"
                          onClick={handleDeleteAccount}
                       >
                          Delete Forever
                       </Button>
                    </div>
                 </div>
              )}
           </div>
        </div>
      )}

    </div>
  );
};

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`w-11 h-6 rounded-full relative transition-colors duration-200 ease-in-out border border-transparent ${
       checked ? 'bg-primary' : 'bg-white/10'
    }`}
  >
     <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 left-0.5 transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
     }`} />
  </button>
);