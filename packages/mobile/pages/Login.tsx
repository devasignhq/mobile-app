import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github } from 'lucide-react';
import { Button } from '../components/Shared';
import { theme } from '../styles/theme';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    // Simulate auth delay
    setTimeout(() => {
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/explorer');
    }, 1500);
  };

  return (
    <div className={theme.layout.centeredPage}>
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="z-10 w-full max-w-sm flex flex-col items-center text-center space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
             <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full"></div>
             {/* Custom SVG Logo matching the uploaded asset */}
             <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10 drop-shadow-2xl hover:scale-105 transition-transform duration-500">
                {/* Left Chevron - Light Orange */}
                <path 
                  d="M38 25 L16 50 L38 75" 
                  stroke="#FDBA74" 
                  strokeWidth="14" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                
                {/* Right Circuit Shape - Primary Orange */}
                <path 
                  d="M52 50 L76 22 L94 42 L66 78" 
                  stroke="#FE891F" 
                  strokeWidth="14" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                
                {/* White "Holes" for the nodes */}
                <circle cx="52" cy="50" r="4" fill="white" />
                <circle cx="66" cy="78" r="4" fill="white" />
             </svg>
          </div>
          
          <h1 className={theme.typography.h1}>
            Dev<span className="text-primary">Asign</span>
          </h1>
          <p className={theme.typography.body + " text-lg max-w-xs"}>
            Connect with open source. <br/> Earn <span className="text-white font-semibold">USDC</span> for your code.
          </p>
        </div>

        <div className="w-full space-y-4 pt-8">
          <Button 
            onClick={handleLogin} 
            size="lg" 
            fullWidth 
            className="flex items-center gap-3 relative overflow-hidden group"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="animate-pulse">Authenticating...</span>
            ) : (
              <>
                <Github size={20} />
                <span>Continue with GitHub</span>
              </>
            )}
          </Button>
          
          <p className={theme.typography.caption}>
            By continuing, you agree to our Terms of Service.
            <br/>GitHub account required.
          </p>
        </div>
      </div>
    </div>
  );
};