import React, { useState } from 'react';
import { publicTrackingService } from '../services/publicTrackingService';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatters';
import logoImg from '../assets/logo1.png';
import {
  Truck,
  Search,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Package,
  AlertCircle,
  ArrowRight,
  FileCheck
} from 'lucide-react';

const PUBLIC_MILESTONES = [
  'Booked',
  'Picked Up',
  'In Transit',
  'Reached Destination',
  'Out for Delivery',
  'Delivered'
];

export const PublicTrackingPage = () => {
  const [cnInput, setCnInput] = useState('SS251');
  const [trackingResult, setTrackingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    if (!cnInput.trim()) return;

    setLoading(true);
    setError(null);
    setTrackingResult(null);

    try {
      const data = await publicTrackingService.trackShipmentByCN(cnInput.trim());
      setTrackingResult(data);
    } catch (err) {
      setError(err.message || 'Shipment Not Found. Please check the CN number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMilestoneIndex = (statusStr) => {
    const norm = (statusStr || '').toLowerCase();
    if (norm === 'delivered') return 5;
    if (norm === 'out for delivery') return 4;
    if (norm === 'reached destination') return 3;
    if (norm === 'in transit') return 2;
    if (norm === 'picked up') return 1;
    return 0; // Booked
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      {/* PUBLIC HEADER */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt="Speed Setu Logo"
              className="h-10 w-auto object-contain"
            />
            <div>
              <span className="font-extrabold text-base tracking-tight block">SPEED SETU</span>
              <span className="text-[10px] text-slate-400 font-medium">Logistics & Express Freight</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure Public Tracking</span>
          </div>
        </div>
      </header>

      {/* MAIN TRACKING AREA */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-8">
        {/* HERO INPUT CARD */}
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Track Your Shipment</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Enter your Consignment Note (CN) number to get real-time location updates.
            </p>
          </div>

          {/* CN Input Form */}
          <form onSubmit={handleTrack} className="max-w-md mx-auto flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={cnInput}
                onChange={(e) => setCnInput(e.target.value.toUpperCase())}
                placeholder="Enter CN Number (e.g. SS251)"
                className="w-full pl-4 pr-10 py-3 bg-slate-900 border border-slate-700 rounded-xl font-mono font-bold text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-setu-500 uppercase tracking-wider"
              />
              <Package className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 font-bold text-xs bg-setu-600 hover:bg-setu-700 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <span>Finding...</span>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Track</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Clock className="w-8 h-8 text-setu-500 animate-spin mx-auto" />
            <span className="text-xs font-semibold block">Finding your shipment status...</span>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="p-6 bg-rose-950/40 border border-rose-800/60 rounded-xl text-center text-rose-300 space-y-2 max-w-md mx-auto animate-fade-in">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">Shipment Not Found</h4>
            <p className="text-xs text-rose-400">{error}</p>
          </div>
        )}

        {/* TRACKING RESULT DISPLAY */}
        {trackingResult && (
          <div className="space-y-6 animate-fade-in">
            {/* CN Header Summary Card */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-mono tracking-wider block">Consignment Note</span>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black font-mono tracking-tight text-white">{trackingResult.cnNumber}</h2>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-setu-500/20 text-setu-400 border border-setu-500/30">
                      {trackingResult.status}
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right text-xs">
                  <span className="text-slate-400 block">Expected Delivery</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {formatDate(trackingResult.expectedDeliveryDate)}
                  </span>
                </div>
              </div>

              {/* Route Strip */}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">Origin</span>
                  <strong className="text-white font-bold">{trackingResult.origin}</strong>
                </div>
                <ArrowRight className="w-5 h-5 text-setu-500" />
                <div className="text-right">
                  <span className="text-slate-400 text-xs block">Destination</span>
                  <strong className="text-white font-bold">{trackingResult.destination}</strong>
                </div>
              </div>
            </div>

            {/* CUSTOMER MILESTONE PROGRESS TIMELINE */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shipment Progress Timeline</h3>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 relative">
                {PUBLIC_MILESTONES.map((m, idx) => {
                  const currIdx = getMilestoneIndex(trackingResult.status);
                  const isPassed = idx <= currIdx;
                  const isCurrent = idx === currIdx;

                  return (
                    <div key={m} className="flex flex-col items-center text-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                          isCurrent
                            ? 'bg-setu-500 text-white ring-4 ring-setu-500/30 font-black scale-110'
                            : isPassed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-700 text-slate-400 border border-slate-600'
                        }`}
                      >
                        {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={`text-xs mt-2 font-bold ${isCurrent ? 'text-setu-400' : isPassed ? 'text-slate-200' : 'text-slate-500'}`}>
                        {m}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PUBLIC SPECS & POD CARD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-3 text-xs">
                <h3 className="font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 pb-2">
                  Shipment Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Booking Date</span>
                    <span className="font-bold font-mono text-slate-200">{formatDate(trackingResult.bookingDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Freight Mode</span>
                    <span className="font-bold text-setu-400">{trackingResult.mode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Package Count</span>
                    <span className="font-bold text-slate-200">{trackingResult.packages} Boxes</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gross Weight</span>
                    <span className="font-bold font-mono text-slate-200">{trackingResult.actualWeight} Kg</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-3 text-xs">
                <h3 className="font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 pb-2 flex items-center justify-between">
                  <span>Proof of Delivery (POD)</span>
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                </h3>

                {trackingResult.podAvailable ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Proof of Delivery Available</span>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400">
                    POD will be available upon delivery completion.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        © 2026 Speed Setu Logistics Private Limited. All rights reserved.
      </footer>
    </div>
  );
};
