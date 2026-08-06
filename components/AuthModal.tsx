'use client';

import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: () => void;
}

export default function AuthModal({ onAuthenticated }: AuthModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'nagpurhealth') {
      sessionStorage.setItem('nagpur_auth', 'true');
      onAuthenticated();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 space-y-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-blue-100 text-blue-900 mb-2">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Nagpur Municipal Corporation
          </h2>
          <p className="text-sm font-medium text-slate-600">
            Disease Surveillance Portal (MSU Nagpur)
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Enter Dashboard Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-900 text-sm transition-all"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>❌ Incorrect Password. Please try again.</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 transition-all duration-200 transform active:scale-98"
          >
            Access Dashboard ➔
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Metropolitan Surveillance Unit (MSU) Nagpur
        </div>
      </div>
    </div>
  );
}
