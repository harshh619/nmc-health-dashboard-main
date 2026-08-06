'use client';

import React from 'react';
import { Code2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full mt-8 mb-4 py-3.5 px-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-xl shadow-md border border-blue-700/50 text-center space-y-1.5 transition-colors duration-300">
      {/* Line 1: NMC Official Portal Title */}
      <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold tracking-tight">
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
        <span className="text-blue-200 font-normal">- Disease Surveillance Portal</span>
      </div>

      {/* Line 2: Developer & Designation Highlight Badge */}
      <div className="flex items-center justify-center flex-wrap gap-1.5 text-[11px] font-medium text-blue-100">
        <span className="text-blue-200">Designed & Developed by</span>
        <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur border border-white/20 text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
          <Code2 className="w-3 h-3 text-cyan-300" />
          <span>Harsh Wardhan Chandel</span>
        </span>
        <span className="text-blue-200 font-semibold">(Technical Officer I.T., MSU Nagpur)</span>
      </div>
    </footer>
  );
}
