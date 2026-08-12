'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Camera,
  X,
  CheckCircle,
  Navigation,
  Upload,
  AlertCircle,
  Building2,
  User,
  Activity,
} from 'lucide-react';
import { PatientRecord, UserSession } from '../lib/types';
import { WARD_TO_ZONE_MAP, cleanWardName } from '../lib/wardMapping';
import { submitFieldVerification } from '../lib/fieldVerificationSync';

interface FieldVerificationModalProps {
  patient: PatientRecord;
  userSession?: UserSession | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FieldVerificationModal({
  patient,
  userSession,
  onClose,
  onSuccess,
}: FieldVerificationModalProps) {
  const [lat, setLat] = useState<number | ''>(patient.Lat || '');
  const [long, setLong] = useState<number | ''>(patient.Long || '');
  const [selectedWard, setSelectedWard] = useState<string>(
    patient.Ward_Name && patient.Ward_Name.toLowerCase() !== 'unassigned'
      ? cleanWardName(patient.Ward_Name)
      : ''
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(patient.Location_Photo_Url || '');
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  // Get Prabhag / Ward options for this patient's zone (with zone number prefix matching & 100% fail-safe fallback)
  const availableWards = React.useMemo(() => {
    const patientZone = patient.Zone || userSession?.assignedZone || '';

    // Extract Zone number if present (e.g. '2 Dharampeth' -> '2')
    const numMatch = String(patientZone).match(/\d+/);
    const zNum = numMatch ? numMatch[0] : '';

    // Clean zone string for fuzzy text matching (e.g. 'dharampeth' vs 'dharmpeth')
    const cleanInText = String(patientZone).toLowerCase().replace(/[^a-z]/g, '');

    const allWardsSet = new Set<string>();
    const matchedWardsSet = new Set<string>();

    Object.entries(WARD_TO_ZONE_MAP).forEach(([wardKey, zName]) => {
      const cleanW = cleanWardName(wardKey);
      if (cleanW && cleanW !== 'Unknown' && cleanW !== '0') {
        allWardsSet.add(cleanW);

        if (!patientZone) {
          matchedWardsSet.add(cleanW);
        } else {
          const zClean = String(zName || '').trim();
          // Check 1: Match zone number prefix (e.g. '2' matches '2 Dharmpeth')
          if (
            zNum &&
            (zClean.startsWith(zNum) ||
              zClean.startsWith(`Zone No. ${zNum}`) ||
              zClean.startsWith(`Zone No.${zNum}`))
          ) {
            matchedWardsSet.add(cleanW);
          } else {
            // Check 2: Fuzzy text match (e.g. 'dharampeth' vs 'dharmpeth')
            const cleanZText = zClean.toLowerCase().replace(/[^a-z]/g, '');
            if (
              cleanInText &&
              (cleanZText.includes(cleanInText) ||
                cleanInText.includes(cleanZText) ||
                (cleanZText.length >= 4 && cleanInText.length >= 4 && cleanZText.slice(0, 4) === cleanInText.slice(0, 4)))
            ) {
              matchedWardsSet.add(cleanW);
            }
          }
        }
      }
    });

    const finalSet = matchedWardsSet.size > 0 ? matchedWardsSet : allWardsSet;

    return Array.from(finalSet).sort((a, b) => Number(a) - Number(b));
  }, [patient.Zone, userSession?.assignedZone]);

  // Handle GPS Geolocation Auto-Capture
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser/device.');
      return;
    }

    setIsGettingGps(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 1000000) / 1000000);
        setLong(Math.round(pos.coords.longitude * 1000000) / 1000000);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setIsGettingGps(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsError('Could not fetch GPS coordinates. Please enable Location services.');
        setIsGettingGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Handle Photo File Selection / Camera Capture
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('Photo size exceeds 8MB. Please select a smaller photo.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPhotoDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWard) {
      setSubmitError('Please select/confirm the Ward (Prabhag) Name.');
      return;
    }

    if (lat === '' || long === '' || isNaN(Number(lat)) || isNaN(Number(long))) {
      setSubmitError('Please capture or enter valid Latitude and Longitude coordinates.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await submitFieldVerification({
        patientId: patient.Patient_ID || 'N/A',
        patientName: patient.Patient_Name || 'Patient',
        zone: patient.Zone || userSession?.assignedZone || 'Unknown Zone',
        wardName: selectedWard,
        lat: Number(lat),
        long: Number(long),
        locationPhotoUrl: photoDataUrl,
        verifiedBy: userSession?.displayName || 'Field Officer',
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setSubmitError(res.message || 'Failed to submit verification.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Error submitting field verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-fadeIn my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                📍 Field Visit & GPS Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm Location & Upload Photo for Patient ID: <b>{patient.Patient_ID}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Patient Summary Card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {patient.Patient_Name || 'Patient'}
            </span>
            <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded font-extrabold text-[11px]">
              {patient.Disease}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-500" />
              Zone: <b>{patient.Zone || 'Unassigned'}</b>
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-slate-500" />
              Status: <b>{patient.Status || 'Active'}</b>
            </span>
          </div>
          {patient.Address && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t pt-1 mt-1">
              🏠 Address: <b>{patient.Address}</b>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GPS Location Auto-Capture Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>1. GPS Lat & Long Coordinates</span>
              {gpsAccuracy !== null && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                  Accuracy: ±{gpsAccuracy}m
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isGettingGps}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>{isGettingGps ? 'Fetching GPS...' : '📍 Auto-Capture GPS Location'}</span>
              </button>
            </div>

            {gpsError && (
              <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Latitude</span>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 21.145800"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Longitude</span>
                <input
                  type="number"
                  step="any"
                  value={long}
                  onChange={(e) => setLong(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 79.088200"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Ward / Prabhag Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              2. Select Prabhag / Ward No.
            </label>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="">-- Select Verified Prabhag --</option>
              {availableWards.map((w) => (
                <option key={w} value={w}>
                  📍 Prabhag / Ward No. {w}
                </option>
              ))}
            </select>
          </div>

          {/* Location Photo Capture & Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>3. Location Photo Capture</span>
              <span className="text-[10px] text-slate-400">Optional</span>
            </label>

            <div className="relative">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                id="photo-upload-input"
                className="hidden"
              />
              <label
                htmlFor="photo-upload-input"
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-3 cursor-pointer bg-slate-50 dark:bg-slate-800/50 transition-colors"
              >
                {photoDataUrl ? (
                  <div className="relative w-full h-36 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img
                      src={photoDataUrl}
                      alt="Location preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      ✓ Photo Attached
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-bold py-2">
                    <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>📸 Take Photo or Upload Image</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Verify & Submit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
