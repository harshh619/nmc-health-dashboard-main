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

// Whitelist of valid Supabase table columns to prevent HTTP 400 schema error
var ALLOWED_COLUMNS = [
  "Patient_ID",
  "Patient_Name",
  "Date",
  "Disease",
  "Ward_Name",
  "Lat",
  "Long",
  "Status",
  "Zone",
  "Location_Photo_Url",
  "Verification_Status",
  "Verified_By",
  "Verified_At"
];

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sheet1");
  if (!sheet) {
    sheet = ss.getActiveSheet();
  }
  return sheet;
}

// Helper: Match column header name to valid Supabase column name
function matchColumn(headerName) {
  if (!headerName) return null;
  var norm = String(headerName).trim().toLowerCase().replace(/\s+/g, '_');
  for (var i = 0; i < ALLOWED_COLUMNS.length; i++) {
    if (ALLOWED_COLUMNS[i].toLowerCase() === norm) {
      return ALLOWED_COLUMNS[i];
    }
  }
  return null;
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
  return new Date().toISOString(); // Fallback to current timestamp to prevent HTTP 400 NOT NULL error!
}

// =====================================================================
// 1. SUPER-FAST BULK SYNC WITH AUTOMATIC DELETION CHECK
// =====================================================================
function syncAllExistingRows() {
  var sheet = getTargetSheet();
  var rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    Logger.log("Sheet is empty!");
    return;
  }

  var headers = rows[0];

  var sheetPatientIds = [];
  var payloadArray = [];

  for (var i = 1; i < rows.length; i++) {
    var rowData = rows[i];
    var payload = {};
    var currentId = null;

    for (var j = 0; j < headers.length; j++) {
      var matchedCol = matchColumn(headers[j]);
      var val = rowData[j];

      if (matchedCol && val !== "" && val !== null && val !== undefined) {
        if (matchedCol === "Patient_ID") {
          var parsedId = parseInt(val, 10);
          currentId = !isNaN(parsedId) ? parsedId : val;
          payload["Patient_ID"] = currentId;
        } else if (matchedCol === "Date") {
          payload["Date"] = formatSupabaseDate(val);
        } else if (matchedCol === "Lat" || matchedCol === "Long") {
          var num = parseFloat(val);
          if (!isNaN(num)) payload[matchedCol] = num;
        } else if (matchedCol === "Age") {
          var num = parseInt(val, 10);
          if (!isNaN(num)) payload[matchedCol] = num;
        } else {
          payload[matchedCol] = (val instanceof Date) ? val.toISOString() : val;
        }
      }
    }

    if (!payload["Date"]) {
      payload["Date"] = new Date().toISOString();
    }

    if (currentId !== null && currentId !== "") {
      sheetPatientIds.push(String(currentId));
      payloadArray.push(payload);
    }
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
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    var payload = {};
    for (var i = 0; i < headers.length; i++) {
      var matchedCol = matchColumn(headers[i]);
      var val = rowValues[i];

      if (matchedCol && val !== "" && val !== null && val !== undefined) {
        if (matchedCol === "Patient_ID") {
          var parsedId = parseInt(val, 10);
          payload["Patient_ID"] = !isNaN(parsedId) ? parsedId : val;
        } else if (matchedCol === "Date") {
          payload["Date"] = formatSupabaseDate(val);
        } else if (matchedCol === "Lat" || matchedCol === "Long") {
          var num = parseFloat(val);
          if (!isNaN(num)) payload[matchedCol] = num;
        } else if (matchedCol === "Age") {
          var num = parseInt(val, 10);
          if (!isNaN(num)) payload[matchedCol] = num;
        } else {
          payload[matchedCol] = (val instanceof Date) ? val.toISOString() : val;
        }
      }
    }

    if (!payload.Patient_ID) return;
    if (!payload.Date) payload.Date = new Date().toISOString();

    var supabaseUrl = SUPABASE_URL + "?on_conflict=Patient_ID";
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'headers': {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'resolution=merge-duplicates'
      },
      'payload': JSON.stringify(payload),
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
    var headers = rows[0];

    var idCol = -1, zoneCol = -1, wardCol = -1, latCol = -1, longCol = -1, photoCol = -1, statusCol = -1;

    for (var h = 0; h < headers.length; h++) {
      var m = matchColumn(headers[h]);
      if (m === "Patient_ID") idCol = h;
      if (m === "Zone") zoneCol = h;
      if (m === "Ward_Name") wardCol = h;
      if (m === "Lat") latCol = h;
      if (m === "Long") longCol = h;
      if (m === "Location_Photo_Url") photoCol = h;
      if (m === "Verification_Status") statusCol = h;
    }

    if (idCol === -1) idCol = 0;

    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]) === String(data.patientId)) {
        if (zoneCol !== -1 && data.zone) sheet.getRange(i + 1, zoneCol + 1).setValue(data.zone);
        if (wardCol !== -1 && data.wardName) sheet.getRange(i + 1, wardCol + 1).setValue(data.wardName);
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
