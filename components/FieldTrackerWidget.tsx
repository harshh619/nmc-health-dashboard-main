'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import {
  Navigation,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ExternalLink,
  Camera,
  UserCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { PatientRecord, UserSession } from '../lib/types';
import { isVerificationPending } from '../lib/fieldVerificationSync';
import { getZoneForWard } from '../lib/wardMapping';
import FieldVerificationModal from './FieldVerificationModal';

interface FieldTrackerWidgetProps {
  patientData: PatientRecord[];
  userSession?: UserSession | null;
  onRefreshData?: () => void;
  isPrivacyMode?: boolean;
}

export default function FieldTrackerWidget({
  patientData = [],
  userSession,
  onRefreshData,
  isPrivacyMode = false,
}: FieldTrackerWidgetProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'verified'>('pending');
  const [selectedPatientForVisit, setSelectedPatientForVisit] = useState<PatientRecord | null>(null);

  const maskPatientName = (name: string) => {
    if (!name || name === 'N/A') return 'N/A';
    if (!isPrivacyMode) return name;
    return name
      .split(' ')
      .map((word) => (word.length > 1 ? word[0] + '*'.repeat(word.length - 1) : word))
      .join(' ');
  };

  // Filter records requiring verification (Unassigned / Unknown Zone cases show to ALL zones)
  const pendingRecords = useMemo(() => {
    return patientData.filter((d) => {
      if (!isVerificationPending(d)) return false;

      if (userSession?.role === 'ZONE_OFFICER' && userSession.assignedZone) {
        const zVal = getZoneForWard(d.Ward_Name, d.Zone);
        const isUnassigned =
          !zVal ||
          zVal === 'Unknown Zone' ||
          zVal.toLowerCase() === 'unassigned' ||
          zVal.toLowerCase() === 'unknown';

        if (!isUnassigned && zVal !== userSession.assignedZone) {
          return false;
        }
      }
      return true;
    });
  }, [patientData, userSession]);

  // Verified records
  const verifiedRecords = useMemo(() => {
    return patientData.filter((d) => {
      if (isVerificationPending(d)) return false;

      if (userSession?.role === 'ZONE_OFFICER' && userSession.assignedZone) {
        const zVal = getZoneForWard(d.Ward_Name, d.Zone);
        if (zVal && zVal !== 'Unknown Zone' && zVal !== userSession.assignedZone) {
          return false;
        }
      }
      return true;
    });
  }, [patientData, userSession]);

  const activeRecords = activeTab === 'pending' ? pendingRecords : verifiedRecords;

  // Sync the App Badge with the pending records count
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      try {
        if (pendingRecords.length > 0) {
          (navigator as any).setAppBadge(pendingRecords.length);
        } else {
          (navigator as any).clearAppBadge();
        }
      } catch (err) {
        console.error('Error setting app badge:', err);
      }
    }
  }, [pendingRecords.length]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-4 transition-colors duration-300">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📍 Real-Time Field Verification Tracker</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Field Officer GPS Location & Photo Verification Queue for{' '}
              <b>{userSession?.assignedZone || 'All Zones'}</b>
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Pending ({pendingRecords.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'verified'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified ({verifiedRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Content List */}
      {activeRecords.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {activeTab === 'pending'
              ? '🎉 All cases in this zone have been field-verified!'
              : 'No verified field records found.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto pr-1 pb-4">
          {activeRecords.slice(0, 30).map((p) => {
            const isPending = isVerificationPending(p);
            const gMapsUrl =
              p.Lat && p.Long ? `https://www.google.com/maps?q=${p.Lat},${p.Long}` : null;

            return (
              <div
                key={p.Patient_ID}
                className={`p-3 rounded-xl border transition-all space-y-2 relative flex flex-col justify-between ${
                  isPending
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[150px]">
                      {maskPatientName(p.Patient_Name || 'Patient')}
                    </span>
                    <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      ID: #{p.Patient_ID}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-extrabold">
                      {p.Disease}
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      Zone: {p.Zone || 'Unassigned'}
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      Ward: {p.Ward_Name || 'Unassigned'}
                    </span>
                  </div>

                  {/* Location Photo Preview if available */}
                  {p.Location_Photo_Url && (
                    <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mt-1 relative">
                      <Image
                        src={p.Location_Photo_Url}
                        alt="Location photo"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 mt-2">
                  {isPending ? (
                    <button
                      onClick={() => setSelectedPatientForVisit(p)}
                      className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>📍 Complete Field Visit</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between w-full text-[10px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified ({p.Lat?.toFixed(4)}, {p.Long?.toFixed(4)})
                      </span>
                      {gMapsUrl && (
                        <a
                          href={gMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold hover:bg-blue-700 text-[10px] flex items-center gap-1"
                        >
                          <span>Maps</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Field Verification Modal */}
      {selectedPatientForVisit && (
        <FieldVerificationModal
          patient={selectedPatientForVisit}
          userSession={userSession}
          onClose={() => setSelectedPatientForVisit(null)}
          onSuccess={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
}
