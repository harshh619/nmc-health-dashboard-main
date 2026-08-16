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
import { WARD_TO_ZONE_MAP, cleanWardName, formatFullWardName, detectWardFromCoordinates } from '../lib/wardMapping';
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
  const [geoData, setGeoData] = useState<any>(null);
  const [remarks, setRemarks] = useState<string>('');
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [mobileNumber, setMobileNumber] = useState<string>(patient.Mobile_Number || '');

  const isSuperAdmin = userSession?.role === 'SUPER_ADMIN';

  // Fetch GeoJSON boundary data for map point-in-polygon verification
  useEffect(() => {
    async function loadGeoJson() {
      try {
        let res = await fetch('/wards_simplified.geojson');
        if (!res.ok) res = await fetch('/wards.geojson');
        if (res.ok) {
          const data = await res.json();
          setGeoData(data);
        }
      } catch (err) {
        console.warn('GeoJSON boundary load error:', err);
      }
    }
    loadGeoJson();
  }, []);

  // Detect exact Prabhag/Ward number from captured GPS coordinates on map boundary
  const detectedWardFromGps = React.useMemo(() => {
    return detectWardFromCoordinates(Number(lat), Number(long), geoData);
  }, [lat, long, geoData]);

  // Get Prabhag / Ward options for this patient's zone (with zone number prefix matching & 100% fail-safe fallback)
  const availableWards = React.useMemo(() => {
    const patientZone = userSession?.role !== 'SUPER_ADMIN' && userSession?.assignedZone
      ? userSession.assignedZone
      : patient.Zone || '';

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

  // Handle GPS Geolocation Auto-Capture & Map Ward Auto-Set
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsGettingGps(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = Math.round(pos.coords.latitude * 1000000) / 1000000;
        const cLong = Math.round(pos.coords.longitude * 1000000) / 1000000;
        setLat(cLat);
        setLong(cLong);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setIsGettingGps(false);

        // Auto-detect ward from coordinates if available
        const autoW = detectWardFromCoordinates(cLat, cLong, geoData);
        if (autoW) {
          setSelectedWard(autoW);
        }
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

  // Handle Photo File Selection / Camera Capture with GPS Watermark
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
          // Embed GPS coordinates into the image using Canvas
          const img = new Image();
          img.onload = () => {
            // Scale down the image to a maximum width of 1000px to reduce Base64 size
            const MAX_WIDTH = 1000;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // Draw original image scaled down
              ctx.drawImage(img, 0, 0, width, height);
              
              // Calculate responsive text size based on image width
              const fontSize = Math.max(14, Math.floor(width * 0.03));
              const padding = fontSize;
              const boxHeight = (fontSize * 2) + padding;
              
              // Draw a semi-transparent black strip at the bottom for readability
              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              ctx.fillRect(0, height - boxHeight, width, boxHeight);
              
              // Draw text (Lat, Long, Date)
              ctx.fillStyle = '#ffffff';
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textBaseline = 'top';
              
              const geoText = `Lat: ${lat || 'N/A'}, Long: ${long || 'N/A'}`;
              const dateText = `Date: ${new Date().toLocaleString()}`;
              
              ctx.fillText(geoText, padding, height - boxHeight + (padding / 2));
              ctx.fillText(dateText, padding, height - boxHeight + (padding / 2) + fontSize + 2);
              
              // Get the watermarked image data with aggressive compression
              const watermarkedUrl = canvas.toDataURL('image/jpeg', 0.7);
              setPhotoDataUrl(watermarkedUrl);
            } else {
              setPhotoDataUrl(reader.result as string);
            }
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReportingIssue && !selectedWard) {
      setSubmitError('Please select/confirm the Ward (Prabhag) Name.');
      return;
    }

    if (!isReportingIssue && (lat === '' || long === '' || isNaN(Number(lat)) || isNaN(Number(long)))) {
      setSubmitError('Please capture or enter valid Latitude and Longitude coordinates.');
      return;
    }

    if (isReportingIssue && !remarks.trim()) {
      setSubmitError('Please enter a remark detailing why this patient does not belong to your zone.');
      return;
    }

    if (!isSuperAdmin) {
      const numStr = mobileNumber ? mobileNumber.trim() : '';
      if (!numStr || numStr.length !== 10) {
        setSubmitError('Tracker Mobile Number is compulsory. Please enter exactly 10 digits.');
        return;
      }
      
      // Strict Validation Rules
      const isFakeSequence = /^(1234567890|0987654321|9876543210)$/.test(numStr);
      const isRepeated = /^(\d)\1{9}$/.test(numStr); // blocks 9999999999, 0000000000, etc.
      const isValidPrefix = /^[6-9]/.test(numStr); // Must start with 6, 7, 8, or 9

      if (isFakeSequence || isRepeated || !isValidPrefix) {
        setSubmitError('🚨 Invalid Mobile Number: Please enter a real and working 10-digit mobile number. Fake/Test numbers are blocked.');
        return;
      }
    }

    if (!isReportingIssue && !isSuperAdmin) {
      if (!photoDataUrl) {
        setSubmitError('Location Photo is compulsory. Please capture or upload a photo.');
        return;
      }
    }

    // Strict Spatial Boundary Guard: Prevent submission of mismatched/fake location or ward selection
    if (!isReportingIssue && geoData) {
      if (!detectedWardFromGps) {
        setSubmitError(
          `🚨 Invalid Location Coordinates: The captured GPS location (${lat}, ${long}) lies OUTSIDE Nagpur Municipal Corporation (NMC) ward boundaries. Please capture valid coordinates within Nagpur.`
        );
        return;
      }

      const cleanSelected = cleanWardName(selectedWard);
      const cleanDetected = cleanWardName(detectedWardFromGps);

      if (cleanSelected && cleanDetected && cleanSelected !== cleanDetected) {
        setSubmitError(
          `🚨 Spatial Boundary Mismatch Blocked: Captured GPS coordinates belong to Prabhag No. ${cleanDetected}, but you selected Prabhag No. ${cleanSelected}. Please click "Auto-Set Prabhag ${cleanDetected}" to correct.`
        );
        return;
      }
      
      // Strict Zone Guard: Prevent employee from submitting if the ward is not in their allowed list
      if (cleanSelected && !availableWards.includes(cleanSelected)) {
        setSubmitError(
          `🚨 Zone Restriction Blocked: Prabhag No. ${cleanSelected} does not belong to your assigned zone (${patient.Zone || userSession?.assignedZone || 'Unknown'}). You can only submit data for your assigned wards.`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await submitFieldVerification({
        patientId: patient.Patient_ID || 'N/A',
        patientName: patient.Patient_Name || 'Patient',
        disease: patient.Disease || 'Unknown',
        status: patient.Status || 'Active',
        date: patient.Date || new Date().toISOString().split('T')[0],
        zone: patient.Zone || userSession?.assignedZone || 'Unknown Zone',
        wardName: formatFullWardName(selectedWard || 'Unassigned'),
        lat: Number(lat || 0),
        long: Number(long || 0),
        locationPhotoUrl: photoDataUrl,
        verifiedBy: userSession?.displayName || 'Field Officer',
        remarks: remarks,
        mobileNumber: mobileNumber,
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

        <form onSubmit={handleSubmit} className="space-y-1.5">
          {/* GPS Location Auto-Capture Section */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between mb-0">
              <span>1. GPS Coordinates</span>
              {gpsAccuracy !== null && (
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1 rounded font-bold">
                  ±{gpsAccuracy}m
                </span>
              )}
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isGettingGps}
                className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{isGettingGps ? 'Fetching...' : '📍 Auto-Capture GPS'}</span>
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
            <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-0.5">
              2. Select Prabhag No.
            </label>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base md:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="">Select Prabhag...</option>
              {availableWards.map((w) => (
                <option key={w} value={w}>{`📍 Prabhag No. ${w}`}</option>
              ))}
            </select>

            {/* GPS Map Boundary Verification Alert */}
            {detectedWardFromGps && (
              <div
                className={`mt-2 p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors duration-300 ${
                  cleanWardName(selectedWard) === cleanWardName(detectedWardFromGps)
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className={`w-4 h-4 flex-shrink-0 ${
                    cleanWardName(selectedWard) === cleanWardName(detectedWardFromGps)
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`} />
                  <div>
                    <span className="font-bold block">
                      {cleanWardName(selectedWard) === cleanWardName(detectedWardFromGps)
                        ? '✓ GPS Map Boundary Matched:'
                        : '🚨 Spatial Boundary Mismatch Detected:'}
                    </span>
                    <span className="text-[11px] opacity-90">
                      Coordinates map directly inside <b>Prabhag No. {detectedWardFromGps}</b>.
                      {cleanWardName(selectedWard) !== cleanWardName(detectedWardFromGps) && (
                        <span className="block text-rose-700 dark:text-rose-300 font-bold mt-0.5">
                          Submission is BLOCKED until ward selection is corrected.
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                {cleanWardName(selectedWard) !== cleanWardName(detectedWardFromGps) && (
                  <button
                    type="button"
                    onClick={() => setSelectedWard(detectedWardFromGps)}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    <span>Fix & Auto-Set Prabhag {detectedWardFromGps}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile Number Capture */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>3. Mobile Number</span>
              <span className={`text-[9px] ${isSuperAdmin ? 'text-slate-400' : 'text-rose-500 font-bold'}`}>
                {isSuperAdmin ? 'Optional' : 'Compulsory'}
              </span>
            </label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="e.g. 9876543210"
              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
              maxLength={10}
            />
          </div>

          {/* Location Photo Capture & Preview */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>4. Photo Capture</span>
              <span className={`text-[9px] ${isSuperAdmin ? 'text-slate-400' : 'text-rose-500 font-bold'}`}>
                {isSuperAdmin ? 'Optional' : 'Compulsory'}
              </span>
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
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-lg p-2 cursor-pointer bg-slate-50 dark:bg-slate-800/50 transition-colors"
              >
                {photoDataUrl ? (
                  <div className="relative w-full rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center">
                    <img
                      src={photoDataUrl}
                      alt="Location preview"
                      className="w-full max-h-32 object-contain"
                    />
                    <div className="absolute top-1 right-1 bg-slate-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shadow-sm">
                      ✓ Attached
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-bold py-1">
                    <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>📸 Take Photo</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Issue Reporting / Remarks Section */}
          <div className="space-y-1 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800">
            <label className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isReportingIssue}
                onChange={(e) => {
                  setIsReportingIssue(e.target.checked);
                  if (e.target.checked) setSubmitError('');
                }}
                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <div className="text-[10px]">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Flag as Issue / Not My Zone</span>
              </div>
            </label>
            
            {isReportingIssue && (
              <div className="mt-1">
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                  className="w-full px-2 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[40px]"
                  required
                />
              </div>
            )}
          </div>

          {submitError && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-900/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
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
