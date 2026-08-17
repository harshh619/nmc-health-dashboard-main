'use client';

import React from 'react';

export default function OfflineFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 p-4 text-center">
      <div className="mb-6 text-blue-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 2l20 20" />
          <path d="M8.53 8.53A9 9 0 0 1 12 8c4.97 0 9 4.03 9 9 0 1.15-.22 2.25-.61 3.26" />
          <path d="M19.07 14.93A5.96 5.96 0 0 0 22 17" />
          <path d="M2 17a10 10 0 0 1 14.28-9.4" />
          <path d="M4.93 14.93A6 6 0 0 1 9 13.5" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">You are currently offline</h1>
      <p className="text-slate-600 mb-6 max-w-md">
        The NMC Surveillance Portal requires an active internet connection to fetch real-time disease data and map resources. 
      </p>
      <p className="text-sm text-slate-500">
        Please check your network settings and try again.
      </p>
      <button 
        onClick={() => typeof window !== 'undefined' && window.location.reload()}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition-colors"
      >
        Retry Connection
      </button>
    </div>
  );
}
