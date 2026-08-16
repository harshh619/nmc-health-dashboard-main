'use client';

import React from 'react';

export default function HeaderBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-xl p-2 sm:px-4 sm:py-2 shadow-md mb-1.5 flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center gap-2.5">
        {/* NMC Official Crest Logo */}
        <div className="w-8 h-8 rounded-full bg-white p-0.5 flex items-center justify-center shadow-md flex-shrink-0">
          <img
            src="/logo.png"
            alt="Nagpur Municipal Corporation Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback to emoji crest if image fails
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <div>
          <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
            <span className="block sm:inline">Nagpur Municipal Corporation</span>
            <span className="hidden sm:inline"> - </span>
            <span className="block sm:inline text-[13px] sm:text-lg">Disease Surveillance Portal</span>
          </h1>
          <p className="text-[11px] text-blue-200 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Powered by Metropolitan Surveillance Unit (MSU Nagpur)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
