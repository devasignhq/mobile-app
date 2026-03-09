import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Shared';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Explorer } from './pages/Explorer';
import { BountyDetail } from './pages/BountyDetail';
import { MyTasks } from './pages/MyTasks';
import { SubmitTask } from './pages/SubmitTask';
import { ViewSubmission } from './pages/ViewSubmission';
import { CompletedTaskDetail } from './pages/CompletedTaskDetail';
import { ActiveTaskDetail } from './pages/ActiveTaskDetail';
import { Messages } from './pages/Messages';
import { Wallet } from './pages/Wallet';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { NotificationProvider } from './contexts/NotificationContext';
import { TaskProvider } from './contexts/TaskContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Helper component to handle authentication and initial redirect logic
const AuthHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Route Protection: Redirect to login if not authenticated and not on login page
  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/') {
      navigate('/', { replace: true });
    }

    // Redirect authenticated users away from login page
    if (isAuthenticated && location.pathname === '/') {
      navigate('/explorer', { replace: true });
    }
  }, [location, navigate, isAuthenticated]);

  // Initial Redirect: Always start at explorer if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/explorer', { replace: true });
    }
  }, []); // Run only on mount

  return null;
};

/**
 * Handles the /auth/callback path which exists OUTSIDE the HashRouter.
 * When the backend redirects to /auth/callback?token=..., the browser loads
 * the SPA at that path. This component detects that and renders the AuthCallback
 * page to process the tokens before entering the HashRouter.
 */
const AppRoot: React.FC = () => {
  // Check if we're on the /login/callback path (non-hash route)
  const isAuthCallback = window.location.pathname === '/login/callback';

  if (isAuthCallback) {
    return (
      <AuthProvider>
        <AuthCallback />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <HashRouter>
        <TaskProvider>
          <NotificationProvider>
            <AuthHandler />
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/submit/:taskId" element={<SubmitTask />} />
              <Route path="/submission/:taskId" element={<ViewSubmission />} />
              <Route path="/task/completed/:taskId" element={<CompletedTaskDetail />} />
              <Route path="/task/active/:taskId" element={<ActiveTaskDetail />} />
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/explorer" element={<Explorer />} />
                    <Route path="/bounty/:id" element={<BountyDetail />} />
                    <Route path="/tasks" element={<MyTasks />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/messages/:contactId" element={<Messages />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="*" element={<Navigate to="/explorer" replace />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </NotificationProvider>
        </TaskProvider>
      </HashRouter>
    </AuthProvider>
  );
};

export default AppRoot;