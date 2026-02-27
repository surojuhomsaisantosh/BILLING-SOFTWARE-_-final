import { useState, useEffect, useCallback } from 'react';
import { checkSupabaseConnection } from '@/integrations/supabase/client';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * NetworkStatus – A top-level banner that alerts users when:
 *  1. Their device is offline (navigator.onLine === false)
 *  2. Supabase is unreachable (online but server times out)
 *  Uses the browser online/offline events + periodic Supabase pings.
 */
export function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [isSupabaseReachable, setIsSupabaseReachable] = useState(true);
    const [checking, setChecking] = useState(false);

    // Check Supabase connectivity
    const checkConnection = useCallback(async () => {
        if (!navigator.onLine) {
            setIsSupabaseReachable(false);
            return;
        }
        setChecking(true);
        const reachable = await checkSupabaseConnection();
        setIsSupabaseReachable(reachable);
        setChecking(false);
    }, []);

    // Browser online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Re-check Supabase when coming back online
            checkConnection();
        };
        const handleOffline = () => {
            setIsOnline(false);
            setIsSupabaseReachable(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        checkConnection();

        // Periodic check every 30 seconds
        const interval = setInterval(checkConnection, 30_000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [checkConnection]);

    // Everything is fine — render nothing
    if (isOnline && isSupabaseReachable) return null;

    const message = !isOnline
        ? 'You are offline. Please check your internet connection.'
        : 'Cannot reach the server. The service may be temporarily unavailable.';

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#fff',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                animation: 'slideDown 0.3s ease-out',
            }}
        >
            <WifiOff size={18} />
            <span>{message}</span>
            <button
                onClick={checkConnection}
                disabled={checking}
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    cursor: checking ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '13px',
                }}
            >
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                {checking ? 'Checking...' : 'Retry'}
            </button>
            <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
        </div>
    );
}
