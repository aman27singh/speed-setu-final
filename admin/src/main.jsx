import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 p-6 rounded-xl border border-rose-500/40 text-center space-y-4 shadow-2xl">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xl mb-1">
              ⚠️
            </div>
            <h2 className="text-base font-bold text-white">Speed Setu Application Exception</h2>
            <p className="text-xs text-rose-300 font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-left overflow-auto max-h-40 leading-relaxed">
              {this.state.error?.message || String(this.state.error)}
            </p>
            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/admin/login';
                }}
                className="px-4 py-2 text-xs font-bold bg-setu-600 hover:bg-setu-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Reset Session & Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
