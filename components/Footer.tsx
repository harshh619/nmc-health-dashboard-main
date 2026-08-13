'use client';

import React from 'react';
import { Code2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full mt-6 mb-4 py-3.5 px-3 sm:px-6 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-xl shadow-md border border-blue-700/50 text-center space-y-2 transition-colors duration-300">
      {/* Line 1: NMC Official Portal Title */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm font-extrabold tracking-tight">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white p-0.5 flex items-center justify-center shadow-xs flex-shrink-0">
            <img
              src="/logo.png"
              alt="NMC Logo"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span className="text-white">Nagpur Municipal Corporation (NMC)</span>
        </div>
        <span className="hidden sm:inline text-blue-300">•</span>
        <span className="text-blue-200 text-[11px] sm:text-xs font-semibold">
          Disease Surveillance Portal
        </span>
      </div>

      {/* Line 2: Developer & Designation Highlight Badge */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[11px] sm:text-xs font-medium text-blue-100">
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <span className="text-blue-200">Designed & Developed by</span>
          <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur border border-white/20 text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
            <Code2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>Harsh Wardhan Chandel</span>
          </span>
        </div>
        <span className="text-blue-200 text-[10px] sm:text-[11px] font-semibold">
          (Technical Officer I.T., MSU Nagpur)
        </span>
      </div>
    </footer>
  );
}
