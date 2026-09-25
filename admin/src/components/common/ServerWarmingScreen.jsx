import React, { useState, useEffect } from 'react';
import {
  Truck,
  Server,
  Database,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Wifi,
  AlertTriangle
} from 'lucide-react';
import { BASE_URL } from '../../services/apiClient';

export const ServerWarmingScreen = ({ onReady, isDriver = false }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Pinging Render backend service...');
  const [progress, setProgress] = useState(15);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const checkBackendHealth = async () => {
    setIsRetrying(true);
    setHasFailed(false);
    setErrorMessage('');
    setStatusMessage('Waking up Speed Setu cloud engine on Render...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 65000); // 65s timeout for Render cold start

      const res = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.connected || data.status === 'online') {
          setProgress(100);
          setStatusMessage('Backend & MongoDB Atlas connection established!');
          setTimeout(() => {
            if (onReady) onReady();
          }, 400);
          return true;
        } else {
          setHasFailed(true);
          setErrorMessage(data.error || 'MongoDB Atlas connection is starting up...');
        }
      } else {
        setHasFailed(true);
        setErrorMessage(`Server returned status HTTP ${res.status}. Retrying...`);
      }
    } catch (err) {
      console.warn('[Server Warming Screen] Ping failed or timed out:', err.message);
      setHasFailed(true);
      if (err.name === 'AbortError') {
        setErrorMessage('Server start request timed out after 65s. Please retry.');
      } else {
        setErrorMessage('Cloud backend is still initializing or network is unreachable.');
      }
    } finally {
      setIsRetrying(false);
    }

    return false;
  };

  useEffect(() => {
    let timer;
    let progressTimer;

    // Check health immediately on mount
    checkBackendHealth();

    // Elapsed timer counter
    timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Smooth progress simulation while waiting for Render cold start
    progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + 5;
        if (prev < 75) return prev + 2;
        if (prev < 90) return prev + 0.5;
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(progressTimer);
    };
  }, []);

  // Update dynamic status message based on elapsed seconds
  useEffect(() => {
    if (hasFailed) return;

    if (elapsedSeconds > 25) {
      setStatusMessage('Connecting to MongoDB Atlas Cloud Cluster...');
    } else if (elapsedSeconds > 12) {
      setStatusMessage('Waking up Render web instance container...');
    } else if (elapsedSeconds > 5) {
      setStatusMessage('Initializing Speed Setu API routes...');
    }
  }, [elapsedSeconds, hasFailed]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 px-4 py-8 overflow-y-auto">
      {/* Top Header & Brand */}
      <div className="w-full max-w-md pt-4 text-center">
        <div className="inline-flex items-center justify-center space-x-2 bg-slate-800/80 backdrop-blur border border-slate-700/60 px-4 py-1.5 rounded-full shadow-lg mb-4">
          <Sparkles className="w-4 h-4 text-setu-400 animate-spin-slow" />
          <span className="text-xs font-bold tracking-wide text-slate-300 uppercase">
            Speed Setu Transport OS
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-2">
          <span>Speed Setu</span>
          <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-setu-600/30 text-setu-400 border border-setu-500/30">
            DRIVER PORTAL
          </span>
        </h1>
      </div>

      {/* Central Visual Loading Card */}
      <div className="w-full max-w-md my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-setu-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Animation Container */}
          <div className="flex justify-center mb-6 relative">
            <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-tr from-setu-600 via-blue-600 to-indigo-600 p-0.5 shadow-xl shadow-setu-600/30 animate-pulse">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Truck className="w-11 h-11 text-setu-400 animate-bounce" />
              </div>
            </div>

            {/* Floating Orbit Badges */}
            <div className="absolute -top-1 -right-1 bg-slate-800 border border-slate-700 text-setu-400 p-1.5 rounded-xl shadow">
              <Server className="w-4 h-4 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -left-1 bg-slate-800 border border-slate-700 text-emerald-400 p-1.5 rounded-xl shadow">
              <Database className="w-4 h-4" />
            </div>
          </div>

          {/* Main Title & Status */}
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-lg font-bold text-white tracking-tight">
              {hasFailed ? 'Server Starting Up...' : 'Connecting to Server...'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium min-h-[36px]">
              {hasFailed ? errorMessage : statusMessage}
            </p>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-setu-400" />
                <span>Elapsed: {elapsedSeconds}s</span>
              </span>
              <span className="text-setu-400 font-mono font-bold">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-setu-500 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-lg shadow-setu-500/50"
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            </div>
          </div>

          {/* Notice Box for Render Cold Start */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 text-left mb-6">
            <div className="flex items-start space-x-2.5">
              <Wifi className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="text-[11px] text-slate-300 leading-relaxed">
                <span className="font-semibold text-amber-300">Render Free Server Spin-up Notice:</span>{' '}
                Because the backend is hosted on Render free tier, it spins down during inactivity. Initial startup takes around <span className="text-white font-bold">20–40 seconds</span>. Please keep this screen open.
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="space-y-2">
            <button
              onClick={checkBackendHealth}
              disabled={isRetrying}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-setu-600 to-blue-600 hover:from-setu-500 hover:to-blue-500 text-white font-bold text-xs tracking-wide transition-all shadow-lg shadow-setu-600/30 flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Pinging Render Backend...' : 'Ping / Retry Server'}</span>
            </button>

            {onReady && (
              <button
                onClick={onReady}
                className="w-full py-2 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip & Proceed directly to Driver Portal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer System Info */}
      <div className="w-full max-w-md text-center text-[11px] text-slate-500 pb-2 flex items-center justify-between border-t border-slate-800/60 pt-4">
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
          <span>Server: Render Cloud (Singapore)</span>
        </span>
        <span>DB: MongoDB Atlas</span>
      </div>
    </div>
  );
};
