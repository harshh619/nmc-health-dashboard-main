'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Printer,
  Maximize,
  Minimize,
  RefreshCw,
  LogOut,
  Building2,
  Crown,
  Navigation,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserSession } from '../lib/types';

interface CommandToolbarProps {
  dataSource: string;
  onRefresh?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  userSession?: UserSession | null;
  onExportCsv?: () => void;
  onLogout?: () => void;
  pendingVerificationsCount?: number;
  onToggleFieldTracker?: () => void;
  isFieldTrackerVisible?: boolean;
  isPrivacyMode?: boolean;
  onTogglePrivacyMode?: () => void;
}

export default function CommandToolbar({
  dataSource,
  onRefresh,
  userSession,
  onExportCsv,
  onLogout,
  pendingVerificationsCount,
  onToggleFieldTracker,
  isFieldTrackerVisible = false,
  isPrivacyMode = false,
  onTogglePrivacyMode,
}: CommandToolbarProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Dark Mode state
  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) =>
        console.error(err)
      );
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 px-2.5 shadow-sm mb-1.5 flex flex-wrap items-center justify-between gap-2.5 transition-colors duration-300">
      {/* Left: System Status Pill & Active User Badge */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{dataSource}</span>
        </div>

        {userSession && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
            userSession.role === 'SUPER_ADMIN'
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
              : userSession.role === 'FIELD_OFFICER'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
          }`}>
            {userSession.role === 'SUPER_ADMIN' ? (
              <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            ) : userSession.role === 'FIELD_OFFICER' ? (
              <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span>{userSession.displayName}</span>
          </div>
        )}

        <span className="hidden lg:inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Nagpur Command Surveillance System
        </span>
      </div>

      {/* Right: Quick Action Command Buttons */}
      <div className="flex flex-wrap items-center justify-start w-full sm:w-auto gap-1 sm:gap-2 mt-1 sm:mt-0">
        {/* Field Tracker Queue Button */}
        {onToggleFieldTracker && (
          <button
            onClick={onToggleFieldTracker}
            className={`flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
              isFieldTrackerVisible
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_12px_rgba(225,29,72,0.8)] animate-pulse'
            }`}
            title="Field Location & Photo Verification Queue"
          >
            <Navigation className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Field Tracker</span>
            {pendingVerificationsCount !== undefined && pendingVerificationsCount > 0 && (
              <span className="bg-white text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold animate-pulse">
                {pendingVerificationsCount}
              </span>
            )}
          </button>
        )}

        {/* Refresh Data Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* CSV Export Button */}
        {onExportCsv && (
          <button
            onClick={onExportCsv}
            className="flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
            title="Download CSV"
          >
            <Printer className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        )}

        {/* PDF Export Button */}
        <button
          onClick={handlePrintPdf}
          className="flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
          title="Print / Export PDF Report"
        >
          <Printer className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">PDF Report</span>
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={toggleFullscreen}
          className="flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          ) : (
            <Maximize className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </span>
        </button>

        {/* Privacy Mode Toggle */}
        {onTogglePrivacyMode && (
          <button
            onClick={onTogglePrivacyMode}
            className={`flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border ${
              isPrivacyMode
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Toggle Privacy Mode (Mask Patient Names)"
          >
            {isPrivacyMode ? (
              <EyeOff className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-rose-600 dark:text-rose-400" />
            ) : (
              <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            )}
            <span className="hidden sm:inline">Privacy</span>
          </button>
        )}

        {/* Dark Mode / Light Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-3 sm:py-1 rounded-lg bg-slate-900 text-amber-400 dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
          title="Toggle Dark / Light Mode"
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Dark</span>
            </>
          ) }
        </button>

        {/* Logout / Switch Account Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex-1 sm:flex-none justify-center px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
            title="Logout / Switch Account"
          >
            <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </div>
  );
}
