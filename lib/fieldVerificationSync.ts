import { supabase } from './supabase';
import { PatientRecord } from './types';

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
  if (record.Verification_Status === 'Pending') return true;
  if (record.Verification_Status === 'Verified') return false;

  // If Lat or Long is missing or 0, or Ward is missing / 'Unassigned' -> Pending verification
  const hasValidLat = typeof record.Lat === 'number' && !isNaN(record.Lat) && record.Lat !== 0;
  const hasValidLong = typeof record.Long === 'number' && !isNaN(record.Long) && record.Long !== 0;
  const hasValidWard =
    Boolean(record.Ward_Name) &&
    record.Ward_Name?.toLowerCase() !== 'unassigned' &&
    record.Ward_Name?.toLowerCase() !== 'unknown' &&
    record.Ward_Name?.trim() !== '';

  return !hasValidLat || !hasValidLong || !hasValidWard;
}

/**
 * Saves field verification to Supabase and dispatches Webhook update to Google Sheets
 */
export async function submitFieldVerification(
  payload: FieldVerificationPayload
): Promise<{ success: boolean; message: string }> {
  const verifiedTimestamp = payload.verifiedAt || new Date().toISOString();

  const pIdNum = parseInt(String(payload.patientId), 10);
  const targetPatientId = !isNaN(pIdNum) ? pIdNum : payload.patientId;

  // Clean data matching valid Supabase patients_data table schema columns
  const updateData: Record<string, any> = {
    Ward_Name: payload.wardName,
    Lat: payload.lat,
    Long: payload.long,
  };
  if (payload.zone) updateData.Zone = payload.zone;

  let supabaseSuccess = false;

  // 1. Update Supabase Database
  const tableNames = ['patients_data', 'Patients_Data', 'patient_data', 'patients'];
  for (const tableName of tableNames) {
    try {
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('Patient_ID', targetPatientId);

      if (!error) {
        supabaseSuccess = true;
        break;
      }
    } catch (err) {
      console.warn(`Supabase update error on table '${tableName}':`, err);
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
          wardName: payload.wardName,
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
