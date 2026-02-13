import React, { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, MessageSquare, Wallet, User as UserIcon, LogOut } from 'lucide-react';
import { theme } from '../styles/theme';

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-lg active:scale-95";
  
  const variants = {
    primary: "bg-primary text-background hover:bg-opacity-90 shadow-lg shadow-orange-900/20",
    secondary: "bg-surface text-text-primary border border-border hover:border-primary/50",
    outline: "bg-transparent border border-primary text-primary hover:bg-primary/10",
    ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5",
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5 h-8",
    md: "text-sm px-4 py-2.5 h-10",
    lg: "text-base px-6 py-3.5 h-12",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

// --- CARD ---
export const Card: React.FC<{ children: ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`${theme.components.card} ${onClick ? 'hover:border-primary/50 cursor-pointer transition-colors' : ''} overflow-hidden relative ${className}`}
  >
    {children}
  </div>
);

// --- BADGE ---
export const Badge: React.FC<{ children: ReactNode; variant?: 'default' | 'outline' | 'success' | 'warning' | 'error'; className?: string }> = ({ 
  children, 
  variant = 'default',
  className = ''
}) => {
  const styles = {
    default: theme.components.badge.primary,
    outline: theme.components.badge.outline,
    success: theme.components.badge.success,
    warning: theme.components.badge.warning,
    error: "bg-error/20 text-error border-error/20",
  };

  return (
    <span className={`${theme.components.badge.base} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

// --- LAYOUT ---
export const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Bounty', path: '/explorer' },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
    { icon: MessageSquare, label: 'Chat', path: '/messages' },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: UserIcon, label: 'Profile', path: '/profile' },
  ];

  const showBottomNav = navItems.some(item => location.pathname === item.path);

  if (location.pathname === '/') return <>{children}</>;

  return (
    <div className="h-screen w-full bg-background text-text-primary flex flex-col overflow-hidden font-sans">
      
      {/* Main Content - Mobile Optimized Scroll Container */}
      <main className={`flex-1 overflow-y-auto scroll-smooth hide-scrollbar ${showBottomNav ? 'pb-24' : ''}`}>
        <div className="w-full min-h-full">
          {children}
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      {showBottomNav && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <nav className="pointer-events-auto flex items-center justify-between gap-1 p-1.5 bg-[#161616]/90 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl shadow-black/90 w-[92%] max-w-md ring-1 ring-white/5">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`relative flex flex-col items-center justify-center flex-1 h-14 rounded-full transition-all duration-300 gap-0.5 ${
                    isActive 
                      ? 'bg-white/10 text-primary translate-y-[-2px]' 
                      : 'text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "translate-y-[1px]" : ""} />
                  <span className="text-[9px] font-light tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};