import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../styles/theme';

/**
 * AuthCallback page — mounted at the real (non-hash) path /login/callback.
 * 
 * The backend OAuth callback redirects here with tokens as query params:
 *   /login/callback?token=...&refreshToken=...&userId=...&username=...&avatarUrl=...
 * 
 * This component reads the params, stores them via AuthContext, cleans the URL,
 * and navigates into the HashRouter at /#/explorer.
 */
export const AuthCallback: React.FC = () => {
    const { login } = useAuth();
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        console.log('AuthCallback: Processing...', window.location.search);

        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');

        // Helper to notify opener and close
        const finish = (msg: any) => {
            if (window.opener) {
                try {
                    window.opener.postMessage(msg, window.location.origin);
                    // Give a tiny delay for the message to be sent before closing
                    setTimeout(() => window.close(), 100);
                } catch (e) {
                    console.error('Failed to postMessage to opener:', e);
                    window.close();
                }
            } else {
                console.log('No opener found, redirecting to home');
                window.location.assign('/#/');
            }
        };

        if (error) {
            console.error('AuthCallback: Error received:', error);
            finish({ type: 'oauth_error', error });
            return;
        }

        const token = params.get('token');
        const refreshToken = params.get('refreshToken');
        const userId = params.get('userId');
        const username = params.get('username');
        const avatarUrl = params.get('avatarUrl');

        if (token && refreshToken && userId) {
            console.log('AuthCallback: Success! Sending tokens to opener.');
            finish({
                type: 'oauth_success',
                payload: { token, refreshToken, userId, username, avatarUrl }
            });
        } else {
            console.error('AuthCallback: Missing required parameters');
            finish({ type: 'oauth_error', error: 'Missing parameters' });
        }
    }, [login]);

    return (
        <div className={theme.layout.centeredPage} style={{ background: '#0D0D0D', color: 'white' }}>
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <h2 className="text-xl font-bold">Authenticating</h2>
                <p className={theme.typography.body}>Communicating with the main application...</p>
                <div className="mt-8 text-xs text-text-secondary opacity-50">
                    If this window doesn't close automatically, you can close it manually.
                </div>
            </div>
        </div>
    );
};
