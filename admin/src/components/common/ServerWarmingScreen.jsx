import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, ArrowRight } from 'lucide-react';
import { BASE_URL } from '../../services/apiClient';

export const ServerWarmingScreen = ({ onReady }) => {
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(10);
  const [status, setStatus] = useState('Initializing application...');
  const [isRetrying, setIsRetrying] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  const checkServer = async () => {
    setIsRetrying(true);
    setStatus('Connecting to Speed Setu server...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(`${BASE_URL}/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.connected || data.status === 'online') {
          setProgress(100);
          setStatus('Connected');
          setTimeout(() => {
            if (onReady) onReady();
          }, 350);
          return;
        }
      }
    } catch (e) {
      console.warn('[Server Check]', e.message);
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    checkServer();

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next > 12) setShowRetry(true);
        return next;
      });
    }, 1000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + 4;
        if (prev < 80) return prev + 2;
        if (prev < 95) return prev + 0.5;
        return prev;
      });
    }, 800);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, []);

  useEffect(() => {
    if (elapsed > 20) {
      setStatus('Waking up cloud backend on Render...');
    } else if (elapsed > 8) {
      setStatus('Starting Speed Setu database engine...');
    } else if (elapsed > 3) {
      setStatus('Connecting to server...');
    }
  }, [elapsed]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0b0f19] text-white select-none px-6 py-12 font-sans overflow-hidden">
      {/* Background Radial Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-setu-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Top Brand Name */}
      <div className="relative z-10 text-center pt-4">
        <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-setu-400 opacity-90">
          SPEED SETU
        </span>
      </div>

      {/* Center Hero Component */}
      <div className="relative z-10 flex flex-col items-center max-w-xs w-full text-center my-auto">
        {/* Sleek Emblem Container with Rippling Glow */}
        <div className="relative flex items-center justify-center w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-setu-500 via-blue-500 to-indigo-500 opacity-20 blur-xl animate-pulse" />
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-setu-500/30 to-blue-500/30 blur-md" />

          <div className="relative w-full h-full rounded-2xl bg-[#111726] border border-slate-700/60 shadow-2xl flex items-center justify-center">
            <Truck className="w-9 h-9 text-setu-400 animate-pulse" />
          </div>
        </div>

        {/* Status Text */}
        <h2 className="text-base font-semibold text-slate-100 tracking-tight mb-1">
          {status}
        </h2>
        <p className="text-xs text-slate-400 font-medium mb-8">
          Please wait a moment ({elapsed}s)
        </p>

        {/* Minimal Glowing Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative shadow-inner mb-6">
          <div
            className="h-full bg-gradient-to-r from-setu-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
            style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
          />
        </div>

        {/* Optional Action Controls (Fades in smoothly if Render is sleeping) */}
        {showRetry && (
          <div className="flex flex-col items-center space-y-3 w-full animate-fade-in">
            <button
              onClick={checkServer}
              disabled={isRetrying}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold transition-all flex items-center justify-center space-x-2 active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-setu-400 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Pinging Backend...' : 'Ping Server Again'}</span>
            </button>

            {onReady && (
              <button
                onClick={onReady}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center space-x-1"
              >
                <span>Continue to app</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Minimal Footer */}
      <div className="relative z-10 text-center">
        <div className="inline-flex items-center space-x-2 text-[11px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Cloud Transport System</span>
        </div>
      </div>
    </div>
  );
};
