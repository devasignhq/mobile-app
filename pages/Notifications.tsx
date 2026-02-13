import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GitMerge, Wallet, MessageSquareText, Server, FileCode, CheckCircle2, X, Clock, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '../components/Shared';
import { useNotifications } from '../contexts/NotificationContext';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { notifications, markAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'match': return <FileCode size={20} className="text-primary" />;
      case 'merge': return <GitMerge size={20} className="text-green-400" />;
      case 'withdrawal': return <Wallet size={20} className="text-text-secondary" />;
      case 'comment': return <MessageSquareText size={20} className="text-text-secondary" />;
      case 'system': return <Server size={20} className="text-text-secondary/50" />;
      default: return <Server size={20} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'match': return 'bg-primary/10 border-primary/20';
      case 'merge': return 'bg-green-500/10 border-green-500/20';
      case 'system': return 'bg-white/5 border-white/5 opacity-50';
      default: return 'bg-surface border-white/10';
    }
  };

  const handleCloseSheet = () => {
    if (selectedId) {
      // Mark as read when closing the sheet
      markAsRead(selectedId);
    }
    setSelectedId(null);
  };

  const selectedNotification = notifications.find(n => n.id === selectedId);

  return (
    <div className="min-h-full bg-background pb-24 relative">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate('/explorer')} 
          className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">Notifications</h1>
      </div>

      <div className="p-4 space-y-3">
        {notifications.map((item) => (
          <div 
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={`
              relative bg-surface border rounded-2xl p-4 overflow-hidden cursor-pointer transition-all duration-300
              ${item.isUnread ? 'bg-primary/5 border-primary/10 opacity-100 shadow-[0_4px_20px_-10px_rgba(254,137,31,0.1)]' : 'border-white/5 opacity-60 hover:opacity-80'}
              active:scale-[0.98]
            `}
          >
            {/* Unread Indicator Bar */}
            {item.isUnread && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_10px_rgba(254,137,31,0.5)]"></div>
            )}

            <div className="flex gap-4 items-start">
              {/* Icon Box */}
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center border shrink-0
                ${getIconBg(item.type)}
              `}>
                {getIcon(item.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <h3 className="font-bold text-base text-white truncate pr-2">{item.title}</h3>
                  <div className="flex items-center gap-1">
                     <span className={`text-xs font-medium ${item.isUnread ? 'text-primary' : 'text-text-secondary'}`}>
                        {item.time}
                     </span>
                     {!item.isUnread && <ChevronRight size={14} className="text-text-secondary/50" />}
                  </div>
                </div>
                
                <p className="text-sm leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                {/* Specific Meta for Merge */}
                {item.type === 'merge' && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-green-500 tracking-wider">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    SUCCESS
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sheet Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleCloseSheet}
          ></div>
          
          {/* Sheet */}
          <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300">
             {/* Handle Bar */}
             <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6"></div>
             
             {/* Header */}
             <div className="flex justify-between items-start mb-4">
                <div>
                   {React.cloneElement(getIcon(selectedNotification.type) as React.ReactElement<any>, { size: 28 })}
                </div>
                <button 
                  onClick={handleCloseSheet}
                  className="p-2 bg-surface rounded-full text-text-secondary hover:text-white hover:bg-white/10 border border-white/5 transition-colors"
                >
                   <X size={20} />
                </button>
             </div>

             <h2 className="text-xl font-bold text-white mb-2 leading-tight">{selectedNotification.title}</h2>
             <div className="flex items-center gap-2 text-text-secondary text-sm mb-6">
                <Clock size={14} />
                <span>Received {selectedNotification.time} ago</span>
             </div>

             <div className="p-5 bg-surface rounded-xl border border-white/5 mb-8">
                <p className="text-base text-gray-300 leading-relaxed">
                   {selectedNotification.details}
                </p>
             </div>

             <div className="flex flex-col gap-3">
                {selectedNotification.actionLink && (
                    <Button 
                        fullWidth 
                        size="lg" 
                        variant="primary"
                        className="flex items-center gap-2 justify-center shadow-xl shadow-primary/10"
                        onClick={() => {
                            if (selectedNotification.isInternal) {
                                handleCloseSheet();
                                navigate(selectedNotification.actionLink!);
                            } else {
                                window.open(selectedNotification.actionLink, '_blank');
                            }
                        }}
                    >
                        {selectedNotification.actionLabel}
                        {!selectedNotification.isInternal && <ExternalLink size={18} className="opacity-80" />}
                    </Button>
                )}
                
                <Button 
                    fullWidth 
                    size="lg" 
                    variant={selectedNotification.actionLink ? "outline" : "primary"}
                    onClick={handleCloseSheet}
                    className={selectedNotification.actionLink ? "border-white/10 text-text-secondary hover:text-white hover:bg-white/5" : ""}
                >
                    {selectedNotification.actionLink ? "Close" : "Dismiss"}
                </Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};