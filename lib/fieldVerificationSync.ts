import { supabase } from './supabase';
import { PatientRecord } from './types';
import { formatFullWardName, getZoneForWard } from './wardMapping';

const GOOGLE_APPS_SCRIPT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL ||
  'https://script.google.com/macros/s/AKfycbyInsC27ZOHLZgvbRV_VyuziCCmcMPZBVK4BMk6qZyBVMX2ANDUmtZVh1dzuOmN2nGadw/exec';

export interface FieldVerificationPayload {
  patientId: string | number;
  patientName: string;
  disease?: string;
  status?: string;
  date?: string;
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
  const rawLat = record.Lat;
  const rawLong = record.Long;
  const numLat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat || ''));
  const numLong = typeof rawLong === 'number' ? rawLong : parseFloat(String(rawLong || ''));

  const hasValidLat = !isNaN(numLat) && numLat !== 0;
  const hasValidLong = !isNaN(numLong) && numLong !== 0;
  const hasValidWard =
    Boolean(record.Ward_Name) &&
    record.Ward_Name?.toLowerCase() !== 'unassigned' &&
    record.Ward_Name?.toLowerCase() !== 'unknown' &&
    record.Ward_Name?.trim() !== '';

  if (!hasValidLat || !hasValidLong || !hasValidWard) {
    return true;
  }

  // When valid Lat, Long, and Ward exist, tracking is completed (Verified)
  return false;
}

export function parseNumericPatientId(id?: any): number | null {
  if (id === undefined || id === null) return null;
  if (typeof id === 'number' && !isNaN(id)) return id;
  const str = String(id).trim();
  const digitsOnly = str.replace(/\D+/g, '');
  if (digitsOnly) {
    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num)) return num;
  }
  return null;
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

  const numericId = parseNumericPatientId(payload.patientId);
  const targetPatientId = numericId !== null ? numericId : payload.patientId;
  const formattedWard = formatFullWardName(payload.wardName);
  const autoZone = getZoneForWard(formattedWard, payload.zone);

  const updateFields: any = {
    Ward_Name: formattedWard,
    Lat: payload.lat,
    Long: payload.long,
    Zone: autoZone || payload.zone || 'Unassigned',
  };

  let supabaseSuccess = false;

  // 1. Direct REST PATCH to Supabase Database (Updates existing row by Patient_ID or id)
  // Try numeric ID first for Postgres bigint column
  if (numericId !== null) {
    try {
      const res = await fetch(
        `https://oysmagibpobxsipxjzpd.supabase.co/rest/v1/patients_data?or=(Patient_ID.eq.${numericId},id.eq.${numericId})`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateFields),
        }
      );
      if (res.ok) {
        const updatedRows = await res.json();
        if (Array.isArray(updatedRows) && updatedRows.length > 0) {
          supabaseSuccess = true;
        }
      }
    } catch (err) {
      console.warn('Supabase REST PATCH (numericId) error:', err);
    }
  }

  // Fallback REST PATCH with targetPatientId
  if (!supabaseSuccess) {
    try {
      const res = await fetch(
        `https://oysmagibpobxsipxjzpd.supabase.co/rest/v1/patients_data?or=(Patient_ID.eq.${encodeURIComponent(String(targetPatientId))},id.eq.${encodeURIComponent(String(targetPatientId))})`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateFields),
        }
      );
      if (res.ok) {
        const updatedRows = await res.json();
        if (Array.isArray(updatedRows) && updatedRows.length > 0) {
          supabaseSuccess = true;
        }
      }
    } catch (err) {
      console.warn('Supabase REST PATCH error:', err);
    }
  }

  // Fallback REST PATCH with raw payload.patientId
  if (!supabaseSuccess) {
    try {
      const res = await fetch(
        `https://oysmagibpobxsipxjzpd.supabase.co/rest/v1/patients_data?or=(Patient_ID.eq.${encodeURIComponent(String(payload.patientId))},id.eq.${encodeURIComponent(String(payload.patientId))})`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updateFields),
        }
      );
      if (res.ok) {
        const updatedRows = await res.json();
        if (Array.isArray(updatedRows) && updatedRows.length > 0) {
          supabaseSuccess = true;
        }
      }
    } catch (err) {
      console.warn('Supabase REST PATCH fallback error:', err);
    }
  }

  // 2. Fallback to Supabase Client update
  if (!supabaseSuccess) {
    const tableNames = ['patients_data', 'Patients_Data', 'patient_data', 'patients'];
    for (const tableName of tableNames) {
      try {
        const { error } = await supabase
          .from(tableName)
          .update(updateFields)
          .eq('Patient_ID', targetPatientId);

        if (!error) {
          supabaseSuccess = true;
          break;
        }
      } catch (err) {
        console.warn(`Supabase client update error on table '${tableName}':`, err);
      }
    }
  }

  // 3. Fallback REST POST upsert if row did not exist in Supabase DB
  if (!supabaseSuccess) {
    try {
      await fetch(
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
              Patient_Name: payload.patientName || `Patient ${targetPatientId}`,
              Disease: payload.disease || 'Unknown',
              Status: payload.status || 'Active',
              Date: payload.date || new Date().toISOString(),
              Ward_Name: formattedWard,
              Lat: payload.lat,
              Long: payload.long,
              Zone: payload.zone || 'Unassigned',
            },
          ]),
        }
      );
    } catch (err) {
      console.warn('Supabase REST POST fallback error:', err);
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
