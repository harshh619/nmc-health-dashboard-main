'use client';

import React from 'react';
import { PatientRecord } from '../lib/types';

interface AiAlertBannerProps {
  patientData: PatientRecord[];
}

const AiAlertBanner = React.memo(function AiAlertBanner({
  patientData,
}: AiAlertBannerProps) {
  if (patientData.length === 0) return null;

  // Determine top affected ward
  const wardCounts: Record<string, number> = {};
  const diseaseCounts: Record<string, number> = {};

  patientData.forEach((row) => {
    if (row.Ward_Name) {
      wardCounts[row.Ward_Name] = (wardCounts[row.Ward_Name] || 0) + 1;
    }
    if (row.Disease) {
      diseaseCounts[row.Disease] = (diseaseCounts[row.Disease] || 0) + 1;
    }
  });

  const topWard =
    Object.entries(wardCounts).sort((a, b) => b[1] - a[1])[0] || [
      'Unknown Ward',
      0,
    ];
  const topDisease =
    Object.entries(diseaseCounts).sort((a, b) => b[1] - a[1])[0] || [
      'Unknown Disease',
      0,
    ];

  return (
    <div className="bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 rounded-xl p-3 text-xs shadow-sm transition-colors duration-300">
      <div className="space-y-1.5 text-xs text-[#881337] dark:text-rose-200">
        <div className="font-extrabold text-[#9f1239] dark:text-rose-300 flex items-center gap-2 text-sm">
          <span>🤖</span>
          <span>Automated Health Intelligence & Alert</span>
        </div>
        <div className="text-[#881337] dark:text-rose-200 leading-relaxed">
          🚨 <b>High-Risk Hotspot:</b>{' '}
          <b className="text-[#e11d48] dark:text-rose-400 underline decoration-rose-400">{topWard[0]}</b> is currently the most
          affected area with <b className="text-[#e11d48] dark:text-rose-400">{topWard[1]} active cases</b>!
        </div>
        <div className="text-[#881337] dark:text-rose-200 leading-relaxed">
          🦠 <b>Insight:</b> Based on the current dataset,{' '}
          <b className="text-[#e11d48] dark:text-rose-400">{topDisease[0]}</b> is detected as the
          most prominent disease in this region. Immediate vector control
          activities and public health awareness campaigns are highly
          recommended.
        </div>
      </div>
    </div>
  );
});

export default AiAlertBanner;
