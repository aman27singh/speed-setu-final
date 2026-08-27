import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, WifiOff } from 'lucide-react';

export const DatabaseStatusBanner = () => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const apiUrl = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:5050/api' : null);

    if (!apiUrl) {
      setHasError(false);
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setHasError(false);
          setErrorMessage('');
        } else {
          setHasError(true);
          setErrorMessage(data.error || 'MongoDB Atlas database is disconnected or unreachable.');
        }
      } else {
        setHasError(true);
        setErrorMessage('MongoDB Atlas Database Connection Failed (HTTP 503 Service Unavailable)');
      }
    } catch (err) {
      if (isLocal) {
        setHasError(true);
        setErrorMessage('Unable to connect to Speed Setu API / MongoDB Atlas Cloud database.');
      } else {
        setHasError(false);
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial health check
    checkHealth();

    // Health check polling interval (every 10 seconds)
    const interval = setInterval(checkHealth, 10000);

    // Event listeners from apiClient
    const handleErrorEvent = (e) => {
      setHasError(true);
      setErrorMessage(e.detail?.message || 'MongoDB Atlas Connection Error: Unable to query cloud database.');
    };

    const handleRecoveredEvent = () => {
      setHasError(false);
      setErrorMessage('');
    };

    window.addEventListener('db-connection-error', handleErrorEvent);
    window.addEventListener('db-connection-recovered', handleRecoveredEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('db-connection-error', handleErrorEvent);
      window.removeEventListener('db-connection-recovered', handleRecoveredEvent);
    };
  }, []);

  if (!hasError) return null;

  return (
    <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-3 shadow-xl flex items-center justify-between border-b border-red-800 z-50 sticky top-0 animate-fade-in">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="p-2 bg-red-800/80 rounded-lg flex-shrink-0 border border-red-500/50">
          <WifiOff className="w-5 h-5 text-amber-300 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="font-extrabold uppercase tracking-wider text-[10px] bg-red-950 text-red-200 px-2 py-0.5 rounded-full border border-red-700 shadow-inner">
              MongoDB Atlas Connection Error
            </span>
            <span className="font-semibold text-xs text-red-100">
              Database Unreachable
            </span>
          </div>
          <p className="text-xs text-red-50 font-medium truncate mt-0.5">
            {errorMessage || 'Disconnected from MongoDB Atlas Cloud. Live data cannot be retrieved or saved.'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
        <button
          onClick={checkHealth}
          disabled={isChecking}
          className="inline-flex items-center space-x-1.5 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Retry Atlas Connection'}</span>
        </button>
      </div>
    </div>
  );
};
