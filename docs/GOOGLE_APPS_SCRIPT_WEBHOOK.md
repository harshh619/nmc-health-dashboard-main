# Google Apps Script Setup Guide - Fail-Safe Bi-Directional Google Sheet Sync

Follow this guide to enable automatic updates in your Google Sheet whenever a Zone Officer verifies a patient's **GPS Location (Lat/Long)**, **Ward (Prabhag) Name**, or **Location Photo**, and sync Google Sheet data into Supabase safely.

---

## 🛠️ Step 1: Open Google Apps Script Editor

1. Open your Google Sheet
2. Click **Extensions** ➔ **Apps Script**.

---

## 📝 Step 2: Paste the Master Sync Code

Paste the following Apps Script code into `Code.gs`:

```javascript
// =====================================================================
// MASTER GOOGLE SHEETS <---> SUPABASE <---> FIELD APP SYNC SCRIPT
// =====================================================================

var SUPABASE_URL = "https://oysmagibpobxsipxjzpd.supabase.co/rest/v1/patients_data";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c21hZ2licG9ieHNpcHhqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI5NjQ5OSwiZXhwIjoyMTAwODcyNDk5fQ.POUgfgnf89TVWp46ZKIoqP3KykWgFA2jsbgMoEjMYUY";

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sheet1");
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }
  return sheet;
}

// Helper: Standardize Ward Name to "Prabhag No. XX" format
function formatFullWardName(w) {
  if (!w) return "Unassigned";
  var str = String(w).trim();
  if (str.toLowerCase() === "unassigned" || str.toLowerCase() === "unknown" || str === "") {
    return "Unassigned";
  }
  var digits = str.replace(/\D+/g, "");
  if (digits) {
    var p = digits.length === 1 ? "0" + digits : digits;
    return "Prabhag No. " + p;
  }
  return str;
}

// Helper: Format Date safely for Supabase Timestamp NOT NULL column constraint
function formatSupabaseDate(val) {
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (val && typeof val === 'string' && val.trim() !== "") {
    var str = val.trim();
    var parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
      var p0 = parseInt(parts[0], 10);
      var p1 = parseInt(parts[1], 10);
      var p2 = parseInt(parts[2], 10);
      if (!isNaN(p2) && p2 > 1000) {
        var mm = String(Math.min(Math.max(p1, 1), 12)).padStart(2, '0');
        var dd = String(Math.min(Math.max(p0, 1), 31)).padStart(2, '0');
        return p2 + "-" + mm + "-" + dd + "T00:00:00.000Z";
      }
    }
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

// =====================================================================
// 1. SUPER-FAST BULK SYNC WITH UNIFORM KEYS & DELETION CHECK
// =====================================================================
function syncAllExistingRows() {
  var sheet = getTargetSheet();
  var rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    Logger.log("Sheet is empty!");
    return;
  }

  var headers = rows[0].map(function(h) { return String(h).trim(); });

  var idCol = -1, nameCol = -1, dateCol = -1, diseaseCol = -1, wardCol = -1, latCol = -1, longCol = -1, statusCol = -1, zoneCol = -1;

  for (var h = 0; h < headers.length; h++) {
    var norm = headers[h].toLowerCase().replace(/\s+/g, '_');
    if (norm === "patient_id") idCol = h;
    if (norm === "patient_name" || norm === "name") nameCol = h;
    if (norm === "date") dateCol = h;
    if (norm === "disease") diseaseCol = h;
    if (norm === "ward_name" || norm === "ward") wardCol = h;
    if (norm === "lat" || norm === "latitude") latCol = h;
    if (norm === "long" || norm === "longitude") longCol = h;
    if (norm === "status") statusCol = h;
    if (norm === "zone") zoneCol = h;
  }

  if (idCol === -1) idCol = 0;

  var sheetPatientIds = [];
  var payloadArray = [];

  for (var i = 1; i < rows.length; i++) {
    var rowData = rows[i];
    var rawId = rowData[idCol];

    if (rawId === "" || rawId === null || rawId === undefined) continue;

    var parsedId = parseInt(rawId, 10);
    var currentId = !isNaN(parsedId) ? parsedId : rawId;

    var item = {
      "Patient_ID": currentId,
      "Patient_Name": nameCol !== -1 && rowData[nameCol] ? String(rowData[nameCol]) : "Patient " + currentId,
      "Date": dateCol !== -1 ? formatSupabaseDate(rowData[dateCol]) : new Date().toISOString(),
      "Disease": diseaseCol !== -1 && rowData[diseaseCol] ? String(rowData[diseaseCol]) : "Unknown",
      "Ward_Name": wardCol !== -1 && rowData[wardCol] ? formatFullWardName(rowData[wardCol]) : "Unassigned",
      "Lat": latCol !== -1 && parseFloat(rowData[latCol]) ? parseFloat(rowData[latCol]) : null,
      "Long": longCol !== -1 && parseFloat(rowData[longCol]) ? parseFloat(rowData[longCol]) : null,
      "Status": statusCol !== -1 && rowData[statusCol] ? String(rowData[statusCol]) : "Active",
      "Zone": zoneCol !== -1 && rowData[zoneCol] ? String(rowData[zoneCol]) : null
    };

    sheetPatientIds.push(String(currentId));
    payloadArray.push(item);
  }

  var headersConfig = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Range': '0-100000'
  };

  try {
    var getOptions = {
      'method': 'get',
      'headers': headersConfig,
      'muteHttpExceptions': true
    };
    var getResponse = UrlFetchApp.fetch(SUPABASE_URL + "?select=Patient_ID", getOptions);
    var supabaseData = JSON.parse(getResponse.getContentText());

    var supabaseIds = (Array.isArray(supabaseData) ? supabaseData : []).map(function(row) {
      return String(row.Patient_ID);
    });

    var idsToDelete = supabaseIds.filter(function(id) {
      return sheetPatientIds.indexOf(id) === -1;
    });

    if (idsToDelete.length > 0) {
      var deleteUrl = SUPABASE_URL + "?Patient_ID=in.(" + idsToDelete.join(",") + ")";
      var deleteOptions = {
        'method': 'delete',
        'headers': headersConfig,
        'muteHttpExceptions': true
      };
      UrlFetchApp.fetch(deleteUrl, deleteOptions);
      Logger.log("Deleted " + idsToDelete.length + " rows from Supabase.");
    }

    if (payloadArray.length > 0) {
      var upsertUrl = SUPABASE_URL + "?on_conflict=Patient_ID";
      var upsertOptions = {
        'method': 'post',
        'headers': Object.assign({}, headersConfig, {'Prefer': 'resolution=merge-duplicates'}),
        'payload': JSON.stringify(payloadArray),
        'muteHttpExceptions': true
      };
      var upsertResponse = UrlFetchApp.fetch(upsertUrl, upsertOptions);
      Logger.log("Bulk Sync Response Code: " + upsertResponse.getResponseCode());
      Logger.log("Bulk Sync Response Body: " + upsertResponse.getContentText());
    }

  } catch (err) {
    Logger.log("Bulk Sync Error: " + err.toString());
  }
}

// =====================================================================
// 2. REAL-TIME INSTANT SYNC ON EDIT (SAFE OVERWRITE PROTECTION)
// =====================================================================
function onSheetEdit(e) {
  if (!e) return;
  var range = e.range;
  var sheet = range.getSheet();
  var row = range.getRow();
  if (row === 1) return;

  try {
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
    var rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    var idCol = -1, nameCol = -1, dateCol = -1, diseaseCol = -1, wardCol = -1, latCol = -1, longCol = -1, statusCol = -1, zoneCol = -1;

    for (var h = 0; h < headers.length; h++) {
      var norm = headers[h].toLowerCase().replace(/\s+/g, '_');
      if (norm === "patient_id") idCol = h;
      if (norm === "patient_name" || norm === "name") nameCol = h;
      if (norm === "date") dateCol = h;
      if (norm === "disease") diseaseCol = h;
      if (norm === "ward_name" || norm === "ward") wardCol = h;
      if (norm === "lat" || norm === "latitude") latCol = h;
      if (norm === "long" || norm === "longitude") longCol = h;
      if (norm === "status") statusCol = h;
      if (norm === "zone") zoneCol = h;
    }

    if (idCol === -1) idCol = 0;
    var rawId = rowValues[idCol];
    if (rawId === "" || rawId === null || rawId === undefined) return;

    var parsedId = parseInt(rawId, 10);
    var currentId = !isNaN(parsedId) ? parsedId : rawId;

    var payload = {
      "Patient_ID": currentId
    };

    if (nameCol !== -1 && rowValues[nameCol]) payload["Patient_Name"] = String(rowValues[nameCol]);
    if (dateCol !== -1 && rowValues[dateCol]) payload["Date"] = formatSupabaseDate(rowValues[dateCol]);
    if (diseaseCol !== -1 && rowValues[diseaseCol]) payload["Disease"] = String(rowValues[diseaseCol]);
    if (wardCol !== -1 && rowValues[wardCol]) payload["Ward_Name"] = formatFullWardName(rowValues[wardCol]);
    if (latCol !== -1 && parseFloat(rowValues[latCol])) payload["Lat"] = parseFloat(rowValues[latCol]);
    if (longCol !== -1 && parseFloat(rowValues[longCol])) payload["Long"] = parseFloat(rowValues[longCol]);
    if (statusCol !== -1 && rowValues[statusCol]) payload["Status"] = String(rowValues[statusCol]);
    if (zoneCol !== -1 && rowValues[zoneCol]) payload["Zone"] = String(rowValues[zoneCol]);

    var supabaseUrl = SUPABASE_URL + "?on_conflict=Patient_ID";
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'resolution=merge-duplicates'
      },
      'payload': JSON.stringify([payload]),
      'muteHttpExceptions': true
    };

    var res = UrlFetchApp.fetch(supabaseUrl, options);
    Logger.log("OnEdit Response: " + res.getResponseCode() + " " + res.getContentText());
  } catch (err) {
    Logger.log("Real-time Edit Sync Error: " + err.toString());
  }
}

function onEdit(e) {
  onSheetEdit(e);
}

// =====================================================================
// 3. RECEIVE FIELD VERIFICATION FROM APP AND UPDATE GOOGLE SHEET
// =====================================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();
    var rows = sheet.getDataRange().getValues();
    var headers = rows[0].map(function(h) { return String(h).trim(); });

    var idCol = -1, zoneCol = -1, wardCol = -1, latCol = -1, longCol = -1, photoCol = -1, statusCol = -1;

    for (var h = 0; h < headers.length; h++) {
      var norm = headers[h].toLowerCase().replace(/\s+/g, '_');
      if (norm === "patient_id") idCol = h;
      if (norm === "zone") zoneCol = h;
      if (norm === "ward_name" || norm === "ward") wardCol = h;
      if (norm === "lat" || norm === "latitude") latCol = h;
      if (norm === "long" || norm === "longitude") longCol = h;
      if (norm === "location_photo_url") photoCol = h;
      if (norm === "verification_status") statusCol = h;
    }

    if (idCol === -1) idCol = 0;

    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]) === String(data.patientId)) {
        if (zoneCol !== -1 && data.zone) sheet.getRange(i + 1, zoneCol + 1).setValue(data.zone);
        if (wardCol !== -1 && data.wardName) sheet.getRange(i + 1, wardCol + 1).setValue(formatFullWardName(data.wardName));
        if (latCol !== -1 && data.lat) sheet.getRange(i + 1, latCol + 1).setValue(data.lat);
        if (longCol !== -1 && data.long) sheet.getRange(i + 1, longCol + 1).setValue(data.long);
        if (photoCol !== -1 && data.locationPhotoUrl) sheet.getRange(i + 1, photoCol + 1).setValue(data.locationPhotoUrl);
        if (statusCol !== -1) sheet.getRange(i + 1, statusCol + 1).setValue("Verified");
        break;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 🚀 Step 3: Deploy Web App

1. Click **Deploy** ➔ **New deployment**.
2. Select type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Click **Deploy** and copy the **Web App URL**.
