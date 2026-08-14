'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PatientRecord, WeatherData, UserSession } from '../lib/types';
import { fetchPatientData, supabase, normalizeStatus } from '../lib/supabase';
import { cleanWardName, WARD_TO_ZONE_MAP, getZoneForWard } from '../lib/wardMapping';
import { getUserSession, clearUserSession } from '../lib/authConfig';
import { isVerificationPending } from '../lib/fieldVerificationSync';
import { Filter, ChevronRight } from 'lucide-react';

import AuthModal from '../components/AuthModal';
import HeaderBanner from '../components/HeaderBanner';
import CommandToolbar from '../components/CommandToolbar';
import MetricsOverview from '../components/MetricsOverview';
import AiAlertBanner from '../components/AiAlertBanner';
import SidebarFilters from '../components/SidebarFilters';
import PatientDataTable from '../components/PatientDataTable';
import FieldTrackerWidget from '../components/FieldTrackerWidget';
import Footer from '../components/Footer';
import SkeletonLoader from '../components/SkeletonLoader';

// Dynamically import Leaflet map & Recharts charts with { ssr: false } to avoid SSR/hydration errors
const SurveillanceMap = dynamic(
  () => import('../components/SurveillanceMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 font-semibold text-sm">
        🗺️ Loading Surveillance Map...
      </div>
    ),
  }
);

const AnalyticsCharts = dynamic(
  () => import('../components/AnalyticsCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 font-semibold text-sm">
        📊 Loading Visual Analytics...
      </div>
    ),
  }
);

// Palette for diseases
const DISEASE_PALETTE = [
  '#2563eb', // Swine Flu (Blue)
  '#d97706', // JE (Amber)
  '#8b5cf6', // Malaria (Purple)
  '#1e3a8a', // Chikungunya (Navy)
  '#dc2626', // Covid (Red)
  '#db2777', // Scrub Typhos (Pink)
  '#059669', // Dengue (Emerald)
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#4f46e5', // Indigo
];

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSession, setUserSessionState] = useState<UserSession | null>(null);
  const [patientData, setPatientData] = useState<PatientRecord[]>([]);
  const [dataSource, setDataSource] = useState('Loading...');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showFieldTracker, setShowFieldTracker] = useState(false);

  const isFieldOfficer = userSession?.role === 'FIELD_OFFICER';

  // Weather state & live update timestamp
  const [weather, setWeather] = useState<WeatherData>({
    temp: 32.5,
    humidity: 57.0,
    rainfall: 0.0,
  });
  const [lastWeatherUpdated, setLastWeatherUpdated] = useState<string>('');

  // Filter States
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedWards, setSelectedWards] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);

  const handleAuthenticated = (session: UserSession) => {
    setUserSessionState(session);
    setIsAuthenticated(true);
    if (session.role === 'ZONE_OFFICER' && session.assignedZone) {
      setSelectedZones([session.assignedZone]);
    }
  };

  const handleLogout = () => {
    clearUserSession();
    setUserSessionState(null);
    setIsAuthenticated(false);
    setSelectedZones([]);
  };

  const getTodayDateString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to extract Zone from row.Zone or Ward_Name fallback
  const getRowZone = (row: PatientRecord) => {
    return getZoneForWard(row.Ward_Name, row.Zone);
  };

  // Fetch live weather data for Nagpur (21.1458° N, 79.0882° E)
  const fetchWeather = async () => {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=21.1458&longitude=79.0882&current=temperature_2m,relative_humidity_2m,precipitation'
      );
      if (res.ok) {
        const data = await res.json();
        const curr = data.current || {};
        setWeather({
          temp: typeof curr.temperature_2m === 'number' ? Math.round(curr.temperature_2m * 10) / 10 : 30.3,
          humidity: typeof curr.relative_humidity_2m === 'number' ? Math.round(curr.relative_humidity_2m) : 69,
          rainfall: typeof curr.precipitation === 'number' ? Math.round(curr.precipitation * 10) / 10 : 0.0,
        });
        setLastWeatherUpdated(
          new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          })
        );
      }
    } catch (err) {
      console.warn('Weather fetch error:', err);
    }
  };

  // Fetch Patient Data & Set Default Date Window Range (Min Date ➔ Today/Max Date)
  const loadData = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    const { data, dataSource: src } = await fetchPatientData();
    setPatientData(data);
    setDataSource(src);

    const todayStr = getTodayDateString();

    if (data && data.length > 0) {
      const validDates = data
        .map((d) => d.Date)
        .filter((d): d is string => typeof d === 'string' && d.length === 10)
        .sort();

      if (validDates.length > 0) {
        const minDate = validDates[0];
        const maxDateInDataset = validDates[validDates.length - 1];
        const defaultToDate = maxDateInDataset > todayStr ? maxDateInDataset : todayStr;

        if (isInitial) {
          setDateRange([minDate, defaultToDate]);
        } else {
          // Auto-expand "To" date in background sync if newer records arrive
          setDateRange((prev) => {
            if (!prev[1] || prev[1] < defaultToDate) {
              return [prev[0] || minDate, defaultToDate];
            }
            return prev;
          });
        }
      }
    } else if (isInitial) {
      setDateRange(['', todayStr]);
    }

    if (isInitial) {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const session = getUserSession();
    if (session) {
      setUserSessionState(session);
      setIsAuthenticated(true);
      if (session.role === 'ZONE_OFFICER' && session.assignedZone) {
        setSelectedZones([session.assignedZone]);
      }
    }
    loadData(true);
    fetchWeather();

    // 1. Supabase Realtime Channel Subscription (Instant WebSocket push on database update)
    const channel = supabase
      .channel('realtime_patients_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          loadData(false);
        }
      )
      .subscribe();

    // 2. Silent Auto-Sync Polling Interval (every 10 seconds for instant sync without page refresh)
    const autoSyncInterval = setInterval(() => {
      loadData(false);
    }, 10000);

    // 3. Auto-refresh weather every 5 minutes (300,000ms)
    const weatherInterval = setInterval(() => {
      fetchWeather();
    }, 300000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(autoSyncInterval);
      clearInterval(weatherInterval);
    };
  }, []);

  // Filter Logic with String Date Comparison & getRowZone Fallback
  const filteredData = useMemo(() => {
    return patientData.filter((row) => {
      // Date Window Filter (String comparison for precision)
      if (dateRange[0] && dateRange[1] && row.Date) {
        if (row.Date < dateRange[0] || row.Date > dateRange[1]) return false;
      }

      // Multi-select Filters
      if (
        selectedDiseases.length > 0 &&
        (!row.Disease || !selectedDiseases.includes(row.Disease))
      )
        return false;

      if (selectedZones.length > 0) {
        const zoneVal = getRowZone(row);
        const isUnassigned =
          !zoneVal ||
          zoneVal === 'Unknown Zone' ||
          zoneVal.toLowerCase() === 'unassigned' ||
          zoneVal.toLowerCase() === 'unknown';

        // If zone is unknown / unassigned, show to ALL zones!
        // If zone is specified (e.g. "2 Dharampeth"), only show to concerned zone!
        if (!isUnassigned && !selectedZones.includes(zoneVal)) return false;
      }

      if (
        selectedWards.length > 0 &&
        (!row.Ward_Name || !selectedWards.includes(row.Ward_Name))
      )
        return false;

      if (selectedStatuses.length > 0) {
        const rowStatus = normalizeStatus(row.Status);
        const matches = selectedStatuses.some(
          (sel) => normalizeStatus(sel) === rowStatus
        );
        if (!matches) return false;
      }

      if (
        selectedGenders.length > 0 &&
        (!row.Gender || !selectedGenders.includes(row.Gender))
      )
        return false;

      return true;
    });
  }, [
    patientData,
    dateRange,
    selectedDiseases,
    selectedZones,
    selectedWards,
    selectedStatuses,
    selectedGenders,
  ]);

  // Pending verification count for active scope
  const pendingVerificationCount = useMemo(() => {
    return filteredData.filter((d) => isVerificationPending(d)).length;
  }, [filteredData]);

  // Color Mapping for Diseases
  const diseaseColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const uniqueDiseases = Array.from(
      new Set(patientData.map((d) => d.Disease).filter((d): d is string => typeof d === 'string' && d.length > 0))
    );
    uniqueDiseases.forEach((d, idx) => {
      map[d] = DISEASE_PALETTE[idx % DISEASE_PALETTE.length];
    });
    return map;
  }, [patientData]);

  // Reset all filters to default dataset date range (with 'To' date set to Today)
  const resetAllFilters = () => {
    const validDates = patientData
      .map((d) => d.Date)
      .filter((d): d is string => typeof d === 'string' && d.length === 10)
      .sort();

    const todayStr = getTodayDateString();
    if (validDates.length > 0) {
      const minDate = validDates[0];
      const maxDateInDataset = validDates[validDates.length - 1];
      const defaultToDate = maxDateInDataset > todayStr ? maxDateInDataset : todayStr;
      setDateRange([minDate, defaultToDate]);
    } else {
      setDateRange(['', todayStr]);
    }
    setSelectedDiseases([]);
    if (userSession?.role === 'ZONE_OFFICER' && userSession.assignedZone) {
      setSelectedZones([userSession.assignedZone]);
    } else {
      setSelectedZones([]);
    }
    setSelectedWards([]);
    setSelectedStatuses([]);
    setSelectedGenders([]);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans relative">
      {/* Authentication Modal */}
      {!isAuthenticated && (
        <AuthModal onAuthenticated={handleAuthenticated} />
      )}

      {/* Screen Edge Floating Restore Tab Button (when sidebar is collapsed) */}
      {isSidebarCollapsed && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[99999] bg-blue-900 hover:bg-blue-800 text-white rounded-r-xl py-3 px-2 shadow-2xl border-r border-t border-b border-blue-700 flex flex-col items-center gap-1.5 transition-all duration-300 active:scale-95 text-xs font-bold animate-pulse group cursor-pointer"
          title="Open Surveillance Filters (>>)"
        >
          <Filter className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span className="[writing-mode:vertical-lr] tracking-widest uppercase text-[10px] font-extrabold text-blue-100 my-1">
            Filters
          </span>
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      )}

      {isLoading ? (
        <SkeletonLoader />
      ) : (
        <div className="w-full max-w-[1720px] mx-auto px-2 sm:px-4 md:px-6 py-2">
          {/* 🧊 1. FROZEN FIXED LEFT SIDEBAR (Always 100% visible at fixed top-4 left-4) */}
          {!isSidebarCollapsed && (
            <div className="hidden lg:block fixed top-2 left-4 lg:w-[285px] xl:w-[325px] max-h-[calc(100vh-1rem)] overflow-y-auto z-30 transition-all duration-300">
              <SidebarFilters
                allPatientData={patientData}
                filteredData={filteredData}
                dateRange={dateRange}
                setDateRange={setDateRange}
                selectedDiseases={selectedDiseases}
                setSelectedDiseases={setSelectedDiseases}
                selectedZones={selectedZones}
                setSelectedZones={setSelectedZones}
                selectedWards={selectedWards}
                setSelectedWards={setSelectedWards}
                selectedStatuses={selectedStatuses}
                setSelectedStatuses={setSelectedStatuses}
                selectedGenders={selectedGenders}
                setSelectedGenders={setSelectedGenders}
                resetAllFilters={resetAllFilters}
                dataSource={dataSource}
                onToggleCollapse={() => setIsSidebarCollapsed(true)}
                userSession={userSession}
              />
            </div>
          )}

          {/* 2. RIGHT WORKSPACE (Offset by lg:pl-[300px] xl:pl-[340px] so it scrolls smoothly alongside the frozen sidebar) */}
          <div
            className={`w-full max-w-full mx-auto transition-all duration-300 ${
              isSidebarCollapsed
                ? 'lg:pl-0 xl:pl-0'
                : 'lg:pl-[300px] xl:pl-[340px]'
            } space-y-2.5`}
          >
            {/* Header Branding Banner */}
            {!isFieldOfficer && <HeaderBanner />}

            {/* Command Toolbar */}
            <CommandToolbar
              dataSource={dataSource}
              onRefresh={loadData}
              userSession={userSession}
              onLogout={handleLogout}
              pendingVerificationsCount={pendingVerificationCount}
              onToggleFieldTracker={() => setShowFieldTracker(!showFieldTracker)}
              isFieldTrackerVisible={showFieldTracker}
            />

            {/* Real-Time Field Verification & GPS/Photo Location Tracker Widget */}
            {showFieldTracker && (
              <FieldTrackerWidget
                patientData={filteredData}
                userSession={userSession}
                onRefreshData={loadData}
              />
            )}

            {/* Active View Context & Bento Metrics Overview */}
            {!isFieldOfficer && (
              <MetricsOverview
                patientData={filteredData}
                selectedZones={selectedZones}
                selectedWards={selectedWards}
                weather={weather}
                lastUpdated={lastWeatherUpdated}
              />
            )}

            {/* Automated AI Intelligence Hotspot Warning Banner */}
            {!isFieldOfficer && <AiAlertBanner patientData={filteredData} />}

            {/* Recharts Visual Analytics */}
            {!isFieldOfficer && (
              <AnalyticsCharts
                patientData={filteredData}
                diseaseColorMap={diseaseColorMap}
              />
            )}

            {/* React-Leaflet GIS Map with Time-Series Playback */}
            <SurveillanceMap
              patientData={filteredData}
              diseaseColorMap={diseaseColorMap}
              selectedWards={selectedWards}
            />

            {/* Linelist / Patient Data Table */}
            <PatientDataTable patientData={filteredData} />

            {/* Custom Author & Designation Footer */}
            <Footer />
          </div>
        </div>
      )}
    </div>
  );
}
