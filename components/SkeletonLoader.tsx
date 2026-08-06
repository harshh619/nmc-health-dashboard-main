'use client';

import React from 'react';

export default function SkeletonLoader() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Header Banner Skeleton */}
      <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />

      {/* Toolbar Skeleton */}
      <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />

      {/* Bento Grid Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl md:col-span-2 lg:col-span-1" />
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* Alert Banner Skeleton */}
      <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="lg:col-span-9 space-y-4">
          <div className="h-[600px] bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
