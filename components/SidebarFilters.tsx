'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Filter,
  Calendar,
  Search,
  ChevronDown,
  ChevronLeft,
  X,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { PatientRecord } from '../lib/types';
import { cleanWardName, WARD_TO_ZONE_MAP, getZoneForWard } from '../lib/wardMapping';

interface SidebarFiltersProps {
  allPatientData: PatientRecord[];
  filteredData: PatientRecord[];
  dateRange: [string, string];
  setDateRange: (range: [string, string]) => void;
  selectedDiseases: string[];
  setSelectedDiseases: React.Dispatch<React.SetStateAction<string[]>>;
  selectedZones: string[];
  setSelectedZones: React.Dispatch<React.SetStateAction<string[]>>;
  selectedWards: string[];
  setSelectedWards: React.Dispatch<React.SetStateAction<string[]>>;
  selectedStatuses: string[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  selectedGenders: string[];
  setSelectedGenders: React.Dispatch<React.SetStateAction<string[]>>;
  resetAllFilters: () => void;
  dataSource: string;
  onToggleCollapse?: () => void;
}

export default function SidebarFilters({
  allPatientData = [],
  filteredData = [],
  dateRange,
  setDateRange,
  selectedDiseases,
  setSelectedDiseases,
  selectedZones,
  setSelectedZones,
  selectedWards,
  setSelectedWards,
  selectedStatuses,
  setSelectedStatuses,
  selectedGenders,
  setSelectedGenders,
  resetAllFilters,
  dataSource,
  onToggleCollapse,
}: SidebarFiltersProps) {
  const isSupabase = dataSource.includes('Supabase');
  const [syncTime, setSyncTime] = useState('');
  useEffect(() => {
    setSyncTime(
      new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    );
  }, []);

  // Helper to extract Zone from row.Zone or Ward_Name fallback
  const getRowZone = (row: PatientRecord) => {
    return getZoneForWard(row.Ward_Name, row.Zone);
  };

  // Unique options derived from allPatientData
  const allDiseases = useMemo(() => {
    return Array.from(
      new Set(allPatientData.map((d) => d.Disease).filter((d): d is string => Boolean(d)))
    ).sort();
  }, [allPatientData]);

  const allZones = useMemo(() => {
    return Array.from(
      new Set(allPatientData.map((d) => getRowZone(d)).filter((z): z is string => Boolean(z)))
    ).sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [allPatientData]);

  const allWards = useMemo(() => {
    return Array.from(
      new Set(allPatientData.map((d) => d.Ward_Name).filter((w): w is string => Boolean(w)))
    ).sort((a, b) => {
      const numA = parseInt(cleanWardName(a), 10) || 0;
      const numB = parseInt(cleanWardName(b), 10) || 0;
      return numA - numB;
    });
  }, [allPatientData]);

  const allStatuses = useMemo(() => {
    return Array.from(
      new Set(allPatientData.map((d) => d.Status).filter((s): s is string => Boolean(s)))
    ).sort();
  }, [allPatientData]);

  const allGenders = ['Male', 'Female'];

  // Zone Summary based on current filteredData (using getRowZone helper)
  const zoneSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    (filteredData || []).forEach((row) => {
      const zone = getRowZone(row);
      if (zone) {
        counts[zone] = (counts[zone] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([Zone, Cases]) => ({ Zone, Cases }))
      .sort((a, b) => b.Cases - a.Cases);
  }, [filteredData]);

  // Multiselect Component with red tag pills & dark mode support
  const Multiselect = ({
    label,
    options,
    selected,
    setSelected,
  }: {
    label: string;
    options: string[];
    selected: string[];
    setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOptions = options.filter((opt) =>
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleOption = (opt: string) => {
      if (selected.includes(opt)) {
        setSelected(selected.filter((item) => item !== opt));
      } else {
        setSelected([...selected, opt]);
      }
    };

    const removeTag = (opt: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelected(selected.filter((item) => item !== opt));
    };

    return (
      <div className="space-y-1 relative">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Select {label}</span>
          {selected.length > 0 && (
            <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.2 rounded font-bold">
              {selected.length} Selected
            </span>
          )}
        </label>

        {/* Selected Tag Pills Container */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="min-h-[34px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 flex flex-wrap items-center gap-1 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-colors shadow-sm"
        >
          {selected.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 px-1">
              Select {label}...
            </span>
          ) : (
            selected.map((item) => (
              <span
                key={item}
                className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm transition-all animate-fadeIn"
              >
                <span className="truncate max-w-[100px]">{item}</span>
                <X
                  className="w-3 h-3 hover:text-red-200 cursor-pointer flex-shrink-0"
                  onClick={(e) => removeTag(item, e)}
                />
              </span>
            ))
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0" />
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto p-1.5 space-y-1">
            <div className="relative mb-1.5">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${label}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1 bg-slate-50 dark:bg-slate-900 text-xs border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 dark:text-slate-200"
              />
            </div>

            {filteredOptions.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-1.5">
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer select-none transition-colors ${
                      isSelected
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-red-600 focus:ring-red-500 dark:bg-slate-900 dark:border-slate-700 accent-red-600 w-3.5 h-3.5"
                    />
                    <span className="truncate">{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-col justify-between space-y-3 transition-colors duration-300">
      <div className="space-y-3">
        {/* Sidebar Header */}
        <div className="pb-2 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-red-600" />
              <span>Surveillance Filters</span>
            </h2>

            <div className="flex items-center gap-1.5">
              <button
                onClick={resetAllFilters}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                title="Reset All Filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>

              {/* Streamlit Style << Collapse Arrow Button */}
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded-md bg-blue-900 text-white hover:bg-blue-800 shadow-sm transition-transform active:scale-95 flex items-center justify-center"
                  title="Hide Sidebar Filters (<<)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center justify-between text-[10px] bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabase ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                }`}
              />
              {dataSource}
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              Updated {syncTime}
            </span>
          </div>
        </div>

        {/* Date Window Filter */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Date Window Filter</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block mb-0.5">From</span>
              <input
                type="date"
                value={dateRange[0]}
                onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 text-xs border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-sm"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block mb-0.5">To</span>
              <input
                type="date"
                value={dateRange[1]}
                onChange={(e) => setDateRange([dateRange[0], e.target.value])}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 text-xs border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Disease Filter */}
        <Multiselect
          label="Disease"
          options={allDiseases}
          selected={selectedDiseases}
          setSelected={setSelectedDiseases}
        />

        {/* Zone Filter */}
        <Multiselect
          label="Zone"
          options={allZones}
          selected={selectedZones}
          setSelected={setSelectedZones}
        />

        {/* Ward Filter */}
        <Multiselect
          label="Ward"
          options={allWards}
          selected={selectedWards}
          setSelected={setSelectedWards}
        />

        {/* Status Filter */}
        <Multiselect
          label="Patient Status"
          options={allStatuses}
          selected={selectedStatuses}
          setSelected={setSelectedStatuses}
        />

        {/* Gender Filter */}
        <Multiselect
          label="Gender"
          options={allGenders}
          selected={selectedGenders}
          setSelected={setSelectedGenders}
        />
      </div>

      {/* Zone-wise Cases Table (Stretched to Bottom Edge of Screen Fold) */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 mt-auto">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-600" />
            <span>Zone-wise Cases</span>
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            ({zoneSummary.length} zones)
          </span>
        </h3>

        <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-3 border-r border-slate-200 dark:border-slate-700">Zone</th>
                <th className="py-2 px-3 text-right">Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {zoneSummary.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                    No cases matching filters
                  </td>
                </tr>
              ) : (
                zoneSummary.map(({ Zone, Cases }) => (
                  <tr
                    key={Zone}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      {Zone}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white text-xs">
                      {Cases}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom System Status Badge (Fills bottom space 100% completely) */}
        <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>NMC MSU Surveillance</span>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">10 Zones Active</span>
        </div>
      </div>
    </div>
  );
}
