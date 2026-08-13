'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Activity, Thermometer, Droplets, CloudRain } from 'lucide-react';
import { PatientRecord, WeatherData } from '../lib/types';
import { formatStatusDisplay, normalizeStatus } from '../lib/supabase';

interface MetricsOverviewProps {
  patientData: PatientRecord[];
  selectedZones: string[];
  selectedWards: string[];
  weather?: WeatherData;
  lastUpdated?: string;
}

export default function MetricsOverview({
  patientData,
  selectedZones,
  selectedWards,
  weather = { temp: 32.5, humidity: 57.0, rainfall: 0.0 },
  lastUpdated = '',
}: MetricsOverviewProps) {
  const zonesDisplay =
    selectedZones.length > 0 ? selectedZones.join(', ') : 'All Zones';
  const wardsDisplay =
    selectedWards.length > 0 ? selectedWards.join(', ') : 'All Wards';

  // Calculate 30-day comparative trend
  const calculateTrend = (statusFilter?: string) => {
    if (patientData.length === 0) return { delta: '0', isNew: false };

    const dates = patientData
      .map((d) => (d.Date ? new Date(d.Date).getTime() : null))
      .filter((t): t is number => t !== null && !isNaN(t));

    if (dates.length === 0) return { delta: '0', isNew: false };

    const maxDate = dates.reduce((max, cur) => (cur > max ? cur : max), dates[0]);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    let currPeriod = patientData.filter((d) => {
      const t = d.Date ? new Date(d.Date).getTime() : 0;
      return t >= maxDate - thirtyDays;
    });

    let prevPeriod = patientData.filter((d) => {
      const t = d.Date ? new Date(d.Date).getTime() : 0;
      return t >= maxDate - 2 * thirtyDays && t < maxDate - thirtyDays;
    });

    if (statusFilter) {
      const normFilter = normalizeStatus(statusFilter);
      currPeriod = currPeriod.filter((d) => normalizeStatus(d.Status) === normFilter);
      prevPeriod = prevPeriod.filter((d) => normalizeStatus(d.Status) === normFilter);
    }

    const currVal = currPeriod.length;
    const prevVal = prevPeriod.length;

    if (prevVal === 0) {
      return {
        delta: currVal > 0 ? `↑ +${currVal} (New)` : '0',
        isNew: currVal > 0,
      };
    }

    const pctChange = ((currVal - prevVal) / prevVal) * 100;
    const sign = pctChange > 0 ? '↑ +' : '↓ ';
    return {
      delta: `${sign}${Math.abs(pctChange).toFixed(1)}% vs Last 30d`,
      isNew: false,
    };
  };

  // Group by status
  const statusCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    patientData.forEach((row) => {
      const norm = normalizeStatus(row.Status);
      map[norm] = (map[norm] || 0) + 1;
    });
    return map;
  }, [patientData]);

  const totalTrend = calculateTrend();

  return (
    <div className="space-y-3 mb-3">
      {/* 🌤️ 1. SEPARATE WEATHER STATS BAR (3 Cards Layout) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm transition-colors duration-300"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Nagpur Temperature */}
          <div className="bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 p-3 rounded-xl shadow-xs hover:shadow transition-all">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                <span>Nagpur Temperature</span>
              </span>
              <HelpCircle className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mb-1.5">
              {weather.temp} °C
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live • {lastUpdated ? `Updated ${lastUpdated}` : 'Auto Refresh Active'}</span>
            </div>
          </div>

          {/* Relative Humidity */}
          <div className="bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 p-3 rounded-xl shadow-xs hover:shadow transition-all">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                <span>Relative Humidity</span>
              </span>
              <HelpCircle className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mb-1.5">
              {weather.humidity} %
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span>↑ Vector-Borne Risk Factor</span>
            </div>
          </div>

          {/* Precipitation / Rainfall */}
          <div className="bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 p-3 rounded-xl shadow-xs hover:shadow transition-all">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <CloudRain className="w-3.5 h-3.5 text-cyan-500" />
                <span>Precipitation / Rainfall</span>
              </span>
              <HelpCircle className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mb-1.5">
              {weather.rainfall} mm
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span>↑ Waterlogging Index</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 📊 2. ACTIVE VIEW CONTEXT & DISEASE CASE METRICS (4 Cards Layout) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm space-y-2.5 transition-colors duration-300"
      >
        {/* Active View Header */}
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 pb-1">
          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Active View:</span>
          <span className="text-emerald-700 dark:text-emerald-300 font-extrabold bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80 text-[11px]">
            {zonesDisplay} ➔ {wardsDisplay}
          </span>
        </div>

        {/* 4 Disease Case Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Cases (Filtered) */}
          <div className="bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 p-3 rounded-xl shadow-xs hover:shadow transition-all">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              <span>Total Cases (Filtered)</span>
              <HelpCircle className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mb-1.5">
              {patientData.length}
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
              <span>{totalTrend.delta}</span>
            </div>
          </div>

          {/* Status Metric Cards */}
          {Object.entries(statusCounts).map(([status, count]) => {
            const trend = calculateTrend(status);
            const isRecovered =
              status.toLowerCase().includes('recover') ||
              status.toLowerCase().includes('discharge');

            let badgeStyle =
              'text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900';
            if (isRecovered) {
              badgeStyle =
                'text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-900';
            } else if (trend.delta === '0') {
              badgeStyle =
                'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
            }

            return (
              <div
                key={status}
                className="bg-[#f8fafc] dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 p-3 rounded-xl shadow-xs hover:shadow transition-all"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  <span>Status: {formatStatusDisplay(status)}</span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1.5">
                  {count}
                </div>
                <div
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}
                >
                  <span>{trend.delta}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
