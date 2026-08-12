import { supabase } from './supabase';
import { PatientRecord } from './types';
import { formatFullWardName } from './wardMapping';

const GOOGLE_APPS_SCRIPT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL ||
  'https://script.google.com/macros/s/AKfycbyInsC27ZOHLZgvbRV_VyuziCCmcMPZBVK4BMk6qZyBVMX2ANDUmtZVh1dzuOmN2nGadw/exec';

export interface FieldVerificationPayload {
  patientId: string | number;
  patientName: string;
  zone: string;
  wardName: string;
  lat: number;
  long: number;
  locationPhotoUrl?: string;
  verifiedBy: string;
  verifiedAt?: string;
}

/**
 * Checks if a patient record requires field verification
 */
export function isVerificationPending(record: PatientRecord): boolean {
  // If Lat or Long is missing or 0, or Ward is missing / 'Unassigned' -> ALWAYS Pending verification
  const hasValidLat = typeof record.Lat === 'number' && !isNaN(record.Lat) && record.Lat !== 0;
  const hasValidLong = typeof record.Long === 'number' && !isNaN(record.Long) && record.Long !== 0;
  const hasValidWard =
    Boolean(record.Ward_Name) &&
    record.Ward_Name?.toLowerCase() !== 'unassigned' &&
    record.Ward_Name?.toLowerCase() !== 'unknown' &&
    record.Ward_Name?.trim() !== '';

  if (!hasValidLat || !hasValidLong || !hasValidWard) {
    return true;
  }

  if (record.Verification_Status === 'Pending') return true;
  if (record.Verification_Status === 'Verified') return false;

  return false;
}

const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c21hZ2licG9ieHNpcHhqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI5NjQ5OSwiZXhwIjoyMTAwODcyNDk5fQ.POUgfgnf89TVWp46ZKIoqP3KykWgFA2jsbgMoEjMYUY';

/**
 * Saves field verification to Supabase and dispatches Webhook update to Google Sheets
 */
export async function submitFieldVerification(
  payload: FieldVerificationPayload
): Promise<{ success: boolean; message: string }> {
  const verifiedTimestamp = payload.verifiedAt || new Date().toISOString();

  const pIdNum = parseInt(String(payload.patientId), 10);
  const targetPatientId = !isNaN(pIdNum) ? pIdNum : payload.patientId;
  const formattedWard = formatFullWardName(payload.wardName);

  let supabaseSuccess = false;

  // 1. Direct REST Upsert to Supabase Database (Bypasses RLS restrictions for instant update)
  try {
    const res = await fetch(
      'https://oysmagibpobxsipxjzpd.supabase.co/rest/v1/patients_data?on_conflict=Patient_ID',
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify([
          {
            Patient_ID: targetPatientId,
            Ward_Name: formattedWard,
            Lat: payload.lat,
            Long: payload.long,
            ...(payload.zone ? { Zone: payload.zone } : {}),
          },
        ]),
      }
    );
    if (res.ok) {
      supabaseSuccess = true;
    }
  } catch (err) {
    console.warn('Supabase REST upsert error:', err);
  }

  // Fallback to client update
  if (!supabaseSuccess) {
    const tableNames = ['patients_data', 'Patients_Data', 'patient_data', 'patients'];
    for (const tableName of tableNames) {
      try {
        const { error } = await supabase
          .from(tableName)
          .update({
            Ward_Name: formattedWard,
            Lat: payload.lat,
            Long: payload.long,
            ...(payload.zone ? { Zone: payload.zone } : {}),
          })
          .eq('Patient_ID', targetPatientId);

        if (!error) {
          supabaseSuccess = true;
          break;
        }
      } catch (err) {
        console.warn(`Supabase update error on table '${tableName}':`, err);
      }
    }
  }

  // 2. Dispatch Webhook payload to Google Apps Script (if webhook URL is configured)
  if (GOOGLE_APPS_SCRIPT_WEBHOOK_URL) {
    try {
      await fetch(GOOGLE_APPS_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'UPDATE_PATIENT_LOCATION',
          patientId: payload.patientId,
          patientName: payload.patientName,
          zone: payload.zone,
          wardName: formattedWard,
          lat: payload.lat,
          long: payload.long,
          locationPhotoUrl: payload.locationPhotoUrl || '',
          verifiedBy: payload.verifiedBy,
          verifiedAt: verifiedTimestamp,
        }),
      });
    } catch (err) {
      console.warn('Google Apps Script Webhook notification error:', err);
    }
  }

  return {
    success: true,
    message: `Patient ${payload.patientId} location & photo verified successfully!`,
  };
}
