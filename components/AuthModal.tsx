'use client';

import React, { useState } from 'react';
import { Lock, ShieldAlert, User, KeyRound, Building2 } from 'lucide-react';
import { authenticateUser, setUserSession, CREDENTIALS_LIST } from '../lib/authConfig';
import { UserSession } from '../lib/types';

interface AuthModalProps {
  onAuthenticated: (session: UserSession) => void;
}

export default function AuthModal({ onAuthenticated }: AuthModalProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const session = authenticateUser(username, password);
    if (session) {
      setUserSession(session);
      onAuthenticated(session);
    } else {
      setError(true);
    }
  };

  const handleQuickSelect = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-5 animate-fadeIn transition-colors duration-300 max-h-full overflow-y-auto">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center mb-1">
            <img 
              src="/logo.png" 
              alt="NMC Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md"
            />
          </div>
          <h2 className="text-xl sm:text-[22px] sm:whitespace-nowrap font-black text-slate-900 dark:text-white leading-tight">
            Nagpur Municipal Corporation
          </h2>
          <p className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-2">
            Disease Surveillance & Zone Command Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-1">
          {/* Account Scope Dropdown / Username Input */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Select Account / Username</span>
            </label>
            <select
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(false);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
            >
              <optgroup label="Headquarters">
                {CREDENTIALS_LIST.filter((c) => c.role === 'SUPER_ADMIN').map((c) => (
                  <option key={c.username} value={c.username}>
                    👑 {c.displayName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Zonal Medical Officers (Dashboard)">
                {CREDENTIALS_LIST.filter((c) => c.role === 'ZONE_OFFICER').map((c) => (
                  <option key={c.username} value={c.username}>
                    🏢 {c.displayName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Patient Tracking Users (Field Tracking)">
                {CREDENTIALS_LIST.filter((c) => c.role === 'FIELD_OFFICER').map((c) => (
                  <option key={c.username} value={c.username}>
                    📍 {c.displayName}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Enter password..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>❌ Invalid credentials. Please try again.</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 transition-all duration-200 transform active:scale-98 text-sm flex items-center justify-center gap-2"
          >
            <span>Access Zone Dashboard</span>
            <span>➔</span>
          </button>
        </form>

        {/* Demo Credentials Quick-Select Helper */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowDemoGuide(!showDemoGuide)}
            className="w-full text-center text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{showDemoGuide ? 'Hide Demo Logins' : '🔑 View Demo Accounts & Passwords'}</span>
          </button>

          {showDemoGuide && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5 max-h-44 overflow-y-auto">
              <div className="font-extrabold text-slate-700 dark:text-slate-300 border-b pb-1 flex justify-between">
                <span>Account</span>
                <span>User / Pass</span>
              </div>
              {CREDENTIALS_LIST.map((c) => (
                <div
                  key={c.username}
                  onClick={() => handleQuickSelect(c.username, c.password)}
                  className="flex items-center justify-between p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <span className="font-semibold truncate max-w-[170px]">{c.displayName}</span>
                  <code className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-[10px] border border-slate-300 dark:border-slate-700 font-bold">
                    {c.username} / {c.password}
                  </code>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
          Metropolitan Surveillance Unit (MSU) Nagpur
          <span className="hidden sm:inline"> • </span>
          <br className="sm:hidden" />
          Public Health Command
        </div>
      </div>
    </div>
  );
}
