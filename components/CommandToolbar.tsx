'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Printer,
  Maximize,
  Minimize,
  RefreshCw,
} from 'lucide-react';

interface CommandToolbarProps {
  dataSource: string;
  onRefresh?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function CommandToolbar({
  dataSource,
  onRefresh,
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
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 px-2.5 shadow-sm mb-1.5 flex items-center justify-between gap-3 transition-colors duration-300">
      {/* Left: System Status Pill */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{dataSource}</span>
        </div>

        <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Nagpur Command Surveillance System
        </span>
      </div>

      {/* Right: Quick Action Command Buttons */}
      <div className="flex items-center gap-2">
        {/* Refresh Data Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        {/* PDF Export Button */}
        <button
          onClick={handlePrintPdf}
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
          title="Print / Export PDF Report"
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PDF Report</span>
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5" />
          ) : (
            <Maximize className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </span>
        </button>

        {/* Dark Mode / Light Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-1.5 sm:px-3 sm:py-1 rounded-lg bg-slate-900 text-amber-400 dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
          title="Toggle Dark / Light Mode"
        >
          {darkMode ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
