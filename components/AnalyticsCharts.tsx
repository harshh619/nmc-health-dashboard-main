'use client';

import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Sector,
} from 'recharts';
import { PatientRecord } from '../lib/types';
import { cleanWardName, WARD_TO_ZONE_MAP } from '../lib/wardMapping';

interface AnalyticsChartsProps {
  patientData: PatientRecord[];
  diseaseColorMap: Record<string, string>;
}

// Active shape for Donut Chart hover animation
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.25))' }}
      />
    </g>
  );
};

export default function AnalyticsCharts({
  patientData,
  diseaseColorMap,
}: AnalyticsChartsProps) {
  const [activeDiseaseIndex, setActiveDiseaseIndex] = useState<
    number | undefined
  >();

  // 1. Disease Distribution Donut Data
  const diseaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    patientData.forEach((row) => {
      if (row.Disease) {
        counts[row.Disease] = (counts[row.Disease] || 0) + 1;
      }
    });
    return counts;
  }, [patientData]);

  const diseaseData = useMemo(() => {
    return Object.entries(diseaseCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [diseaseCounts]);

  const totalCases = useMemo(() => {
    return diseaseData.reduce((sum, item) => sum + item.value, 0);
  }, [diseaseData]);

  // 2. Top Wards by Total Case Volume
  const topWardsData = useMemo(() => {
    const counts: Record<string, number> = {};
    patientData.forEach((row) => {
      const cWard = cleanWardName(row.Ward_Name);
      if (cWard) {
        counts[cWard] = (counts[cWard] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([ward, Cases]) => ({
        ward: `Prabhag No. ${ward}`,
        rawWard: ward,
        Cases,
      }))
      .sort((a, b) => b.Cases - a.Cases)
      .slice(0, 8);
  }, [patientData]);

  // 3. Timeline / Date Trend Analysis (Sorted string dates)
  const timelineData = useMemo(() => {
    const counts: Record<string, number> = {};
    patientData.forEach((row) => {
      if (row.Date) {
        counts[row.Date] = (counts[row.Date] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([dateStr, Cases]) => {
        let formattedDate = dateStr;
        if (dateStr.length === 10) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
              });
            }
          }
        }
        return { dateStr, formattedDate, Cases };
      })
      .sort((a, b) => (a.dateStr > b.dateStr ? 1 : -1));
  }, [patientData]);

  // 4. Zone vs Disease Risk Matrix (Using Ward-to-Zone Fallback)
  const { riskMatrix, diseasesSet, sortedZonesSet, maxHeatVal } = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    const dSet = new Set<string>();
    const zSet = new Set<string>();
    let maxVal = 0;

    patientData.forEach((row) => {
      if (row.Disease) {
        dSet.add(row.Disease);
        let zone = row.Zone && row.Zone.trim() ? row.Zone.trim() : '';
        if (!zone) {
          const cWard = cleanWardName(row.Ward_Name);
          zone = WARD_TO_ZONE_MAP[cWard] || 'Unknown Zone';
        }

        zSet.add(zone);
        if (!matrix[zone]) matrix[zone] = {};
        matrix[zone][row.Disease] = (matrix[zone][row.Disease] || 0) + 1;

        if (matrix[zone][row.Disease] > maxVal) {
          maxVal = matrix[zone][row.Disease];
        }
      }
    });

    const sortedZ = Array.from(zSet).sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      return numA - numB;
    });

    return {
      riskMatrix: matrix,
      diseasesSet: Array.from(dSet).sort(),
      sortedZonesSet: sortedZ,
      maxHeatVal: maxVal || 1,
    };
  }, [patientData]);

  // 5. Patient Age Demographics
  const ageData = useMemo(() => {
    const groups = {
      '0-12 (Children)': 0,
      '13-18 (Teens)': 0,
      '19-35 (Youth)': 0,
      '36-50 (Adults)': 0,
      '51-65 (Seniors)': 0,
      '65+ (Elders)': 0,
    };

    patientData.forEach((row) => {
      const age = typeof row.Age === 'number' ? row.Age : parseInt(row.Age || '0', 10);
      if (age > 0) {
        if (age <= 12) groups['0-12 (Children)']++;
        else if (age <= 18) groups['13-18 (Teens)']++;
        else if (age <= 35) groups['19-35 (Youth)']++;
        else if (age <= 50) groups['36-50 (Adults)']++;
        else if (age <= 65) groups['51-65 (Seniors)']++;
        else groups['65+ (Elders)']++;
      }
    });

    return Object.entries(groups).map(([group, Patients]) => ({
      group,
      Patients,
    }));
  }, [patientData]);

  // 6. Gender Ratio
  const genderCounts = useMemo(() => {
    const counts: Record<string, number> = { Male: 0, Female: 0 };
    patientData.forEach((row) => {
      if (row.Gender) {
        counts[row.Gender] = (counts[row.Gender] || 0) + 1;
      }
    });
    return counts;
  }, [patientData]);

  const genderData = Object.entries(genderCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const GENDER_COLORS: Record<string, string> = {
    Male: '#3b82f6',
    Female: '#ec4899',
    Other: '#8b5cf6',
  };

  // Custom High-Contrast Tooltip with Crystal Clear Text & Anti-Aliasing
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const val = data.value;
      const title = label || data.name || data.payload?.name || data.payload?.ward || 'Category';
      const pct = totalCases > 0 && typeof val === 'number' ? ((val / totalCases) * 100).toFixed(1) : null;

      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-2xl border border-slate-700/80 font-sans space-y-1 min-w-[130px] z-[99999]">
          <div className="font-extrabold text-slate-200 border-b border-slate-700/60 pb-1 flex items-center justify-between gap-2">
            <span>{title}</span>
            {pct && (
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-1.5 py-0.2 rounded font-bold border border-blue-400/30">
                {pct}%
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-slate-400 font-medium">{data.name || 'Total Cases'}:</span>
            <span className="font-black text-amber-400 text-sm ml-2">{val}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* 🟢 FOLD 1: Disease Distribution Donut & Top Wards Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[380px]">
        {/* Disease Distribution Donut Chart */}
        <div className="lg:col-span-6 xl:col-span-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <span>🦠</span> Disease Distribution
          </h3>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 my-auto w-full min-w-0">
            {/* Donut Circle (Sized to fit perfectly next to legend on right side) */}
            <div className="relative w-36 h-36 min-[400px]:w-40 min-[400px]:h-40 sm:w-44 sm:h-44 md:w-48 md:h-48 flex-shrink-0 flex items-center justify-center my-1 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    {...({
                      data: diseaseData,
                      cx: '50%',
                      cy: '50%',
                      innerRadius: 42,
                      outerRadius: 66,
                      paddingAngle: 3,
                      dataKey: 'value',
                      activeIndex: activeDiseaseIndex,
                      activeShape: renderActiveShape,
                      onMouseEnter: (_: any, index: number) => setActiveDiseaseIndex(index),
                      onMouseLeave: () => setActiveDiseaseIndex(undefined),
                    } as any)}
                  >
                    {diseaseData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={diseaseColorMap[entry.name] || '#3b82f6'}
                        className="cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    isAnimationActive={false}
                    wrapperStyle={{ zIndex: 1000, opacity: 1, pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none z-0">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none">{totalCases}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">Cases</span>
              </div>
            </div>

            {/* Side-by-Side Legend List on RIGHT side of pie chart */}
            <div className="flex-1 w-full min-w-0 space-y-1 sm:space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {diseaseData.map((item, idx) => {
                const pct = ((item.value / totalCases) * 100).toFixed(1);
                const isHovered = activeDiseaseIndex === idx;
                const color = diseaseColorMap[item.name] || '#3b82f6';
                return (
                  <div
                    key={item.name}
                    onMouseEnter={() => setActiveDiseaseIndex(idx)}
                    onMouseLeave={() => setActiveDiseaseIndex(undefined)}
                    className={`flex items-center justify-between gap-1.5 text-xs px-2.5 py-1 rounded-lg border cursor-pointer transition-colors duration-150 min-w-0 ${
                      isHovered
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold border-slate-900 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm border border-white dark:border-slate-800"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-bold text-[11px] truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                      <span className="font-black text-xs">{item.value}</span>
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded font-mono font-bold ${
                          isHovered
                            ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sleek Summary Footer Badge (Fills bottom space perfectly) */}
          <div className="pt-2.5 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>Active Outbreak Pathogens</span>
            <span className="font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/80">
              {diseaseData.length} Tracked
            </span>
          </div>
        </div>

        {/* Top Wards by Total Case Volume */}
        <div className="lg:col-span-6 xl:col-span-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <span>🏢</span> Top Wards by Total Case Volume
          </h3>

          <div className="h-[320px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topWardsData}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis
                  dataKey="ward"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Cases" radius={[6, 6, 0, 0]}>
                  {topWardsData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? '#991b1b'
                          : index < 3
                          ? '#dc2626'
                          : '#fca5a5'
                      }
                      className="transition-all hover:opacity-80 cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 🔵 FOLD 2 (Automatically snaps smoothly into view when scrolling past 50% of Fold 1): Timeline Analysis & Risk Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-24 pt-8 border-t border-slate-200/60 dark:border-slate-800/60 snap-start scroll-mt-6">
        {/* Date Trend / Timeline Analysis (Area Chart) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow transition-all">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <span>📈</span> Date Trend / Timeline Analysis
          </h3>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timelineData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis
                  dataKey="formattedDate"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Cases"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#timelineGradient)"
                  dot={{ r: 3, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#60a5fa', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zone vs Disease Risk Matrix Heatmap */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <span>🔥</span> Zone vs Disease Risk Matrix
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-left font-bold rounded-tl min-w-[120px] max-w-[140px] shadow-[2px_0_5px_-1px_rgba(0,0,0,0.1)] border-r border-slate-200 dark:border-slate-700">
                      Zone / Region
                    </th>
                    {diseasesSet.map((d) => (
                      <th
                        key={d}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold truncate max-w-[80px]"
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedZonesSet.map((z) => (
                    <tr key={z} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="sticky left-0 z-10 p-1.5 text-left font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 truncate min-w-[120px] max-w-[140px] shadow-[2px_0_5px_-1px_rgba(0,0,0,0.1)] border-r border-slate-200 dark:border-slate-800">
                        {z}
                      </td>
                      {diseasesSet.map((d) => {
                        const val = (riskMatrix[z] && riskMatrix[z][d]) || 0;
                        const intensity = val > 0 ? val / maxHeatVal : 0;
                        let bgColor = '#1e293b';
                        let textColor = '#94a3b8';

                        if (intensity > 0.75) {
                          bgColor = '#991b1b';
                          textColor = '#ffffff';
                        } else if (intensity > 0.5) {
                          bgColor = '#dc2626';
                          textColor = '#ffffff';
                        } else if (intensity > 0.25) {
                          bgColor = '#f87171';
                          textColor = '#0f172a';
                        } else if (intensity > 0) {
                          bgColor = '#fca5a5';
                          textColor = '#0f172a';
                        }

                        return (
                          <td
                            key={d}
                            style={{ backgroundColor: bgColor, color: textColor }}
                            className="p-1.5 font-bold rounded transition-all hover:scale-110 cursor-pointer shadow-sm border border-slate-700/30"
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2 font-medium">
            Disease Type →
          </div>
        </div>
      </div>

      {/* Row 3: Age Demographics & Gender Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Patient Age Demographics */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow transition-all">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <span>👥</span> Patient Age Demographics
          </h3>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageData}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis
                  dataKey="group"
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const parts = payload.value.split(' (');
                    const line1 = parts[0];
                    const line2 = parts[1] ? `(${parts[1]}` : '';
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={12} textAnchor="middle" fill="#94a3b8" fontSize={9} className="sm:text-[10px]">
                          <tspan x={0} dy="0">{line1}</tspan>
                          {line2 && <tspan x={0} dy="12">{line2}</tspan>}
                        </text>
                      </g>
                    );
                  }}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Patients" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index % 2 === 0 ? '#2563eb' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Ratio */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <span>🚻</span> Gender Ratio
          </h3>

          <div className="relative w-full h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {genderData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={GENDER_COLORS[entry.name] || '#3b82f6'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none z-0">
              <span className="text-xl font-black text-slate-900 dark:text-white">{totalCases}</span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Total</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
            {genderData.map((g) => {
              const total = genderData.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? ((g.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={g.name} className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: GENDER_COLORS[g.name] || '#3b82f6' }}
                  />
                  <span>
                    {g.name}: <span className="font-black text-slate-900 dark:text-white">{g.value}</span> <span className="font-extrabold text-blue-600 dark:text-blue-400">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
