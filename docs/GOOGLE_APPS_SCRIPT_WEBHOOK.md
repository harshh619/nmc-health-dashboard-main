# Google Apps Script Setup Guide - Automatic Zone Auto-Fill & Bi-Directional Sync

Follow this guide to enable **Automatic Zone Auto-Filling from Ward/Prabhag Name** in your Google Sheet, and keep Supabase and the Live Dashboard 100% in sync.

---

## 🛠️ Step 1: Open Google Apps Script Editor

1. Open your Google Sheet
2. Click **Extensions** ➔ **Apps Script**.

---

## 📝 Step 2: Paste the Master Sync & Auto-Fill Script

Replace all code in `Code.gs` with this master script:

```javascript
// =====================================================================
// MASTER GOOGLE SHEETS <---> SUPABASE <---> FIELD APP SYNC SCRIPT
// WITH AUTOMATIC WARD ➔ ZONE AUTO-FILL ENGINE
// =====================================================================

var SUPABASE_URL = "https://oysmagibpobxsipxjzpd.supabase.co/rest/v1/patients_data";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c21hZ2licG9ieHNpcHhqenBkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI5NjQ5OSwiZXhwIjoyMTAwODcyNDk5fQ.POUgfgnf89TVWp46ZKIoqP3KykWgFA2jsbgMoEjMYUY";

// 38-Prabhag/Ward to 10-Zone Automatic Mapping Dictionary
var WARD_ZONE_LOOKUP = {
  "1": "10 Mangalwari", "01": "10 Mangalwari",
  "2": "9 AashiNagar", "02": "9 AashiNagar",
  "3": "9 AashiNagar", "03": "9 AashiNagar",
  "4": "8 Lakadganj", "04": "8 Lakadganj",
  "5": "7 Satranjipura", "05": "7 Satranjipura",
  "6": "9 AashiNagar", "06": "9 AashiNagar",
  "7": "9 AashiNagar", "07": "9 AashiNagar",
  "8": "6 Gandhibag", "08": "6 Gandhibag",
  "9": "10 Mangalwari", "09": "10 Mangalwari",
  "10": "10 Mangalwari",
  "11": "10 Mangalwari",
  "12": "2 Dharampeth",
  "13": "2 Dharampeth",
  "14": "2 Dharampeth",
  "15": "2 Dharampeth",
  "16": "1 Laxmi Nagar",
  "17": "4 Dhantoli",
  "18": "6 Gandhibag",
  "19": "6 Gandhibag",
  "20": "7 Satranjipura",
  "21": "7 Satranjipura",
  "22": "6 Gandhibag",
  "23": "8 Lakadganj",
  "24": "8 Lakadganj",
  "25": "8 Lakadganj",
  "26": "5 Nehru Nagar",
  "27": "5 Nehru Nagar",
  "28": "5 Nehru Nagar",
  "29": "3 Hanuman Nagar",
  "30": "5 Nehru Nagar",
  "31": "3 Hanuman Nagar",
  "32": "3 Hanuman Nagar",
  "33": "4 Dhantoli",
  "34": "3 Hanuman Nagar",
  "35": "4 Dhantoli",
  "36": "1 Laxmi Nagar",
  "37": "1 Laxmi Nagar",
  "38": "1 Laxmi Nagar"
};

function getZoneFromWard(w) {
  if (!w) return "";
  var str = String(w).trim();
  var digits = str.replace(/\D+/g, "");
  if (digits && WARD_ZONE_LOOKUP[digits]) {
    return WARD_ZONE_LOOKUP[digits];
  }
  return "";
}

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
// 1. BULK SYNC & AUTOMATIC ZONE AUTO-FILL FOR ENTIRE SHEET
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
    if (norm === "patient_id" || norm === "id" || norm === "patient_no" || norm.indexOf("patient") !== -1 || norm.indexOf("id") !== -1) {
      if (idCol === -1) idCol = h;
    }
    if (norm === "patient_name" || norm === "name") nameCol = h;
    if (norm === "date") dateCol = h;
    if (norm === "disease") diseaseCol = h;
    if (norm === "ward_name" || norm === "ward" || norm.indexOf("prabhag") !== -1 || norm.indexOf("ward") !== -1) {
      if (wardCol === -1) wardCol = h;
    }
    if (norm === "lat" || norm === "latitude") latCol = h;
    if (norm === "long" || norm === "longitude") longCol = h;
    if (norm === "status") statusCol = h;
    if (norm === "zone") zoneCol = h;
  }

  if (idCol === -1) idCol = 0;

  var successCount = 0;

  for (var i = 1; i < rows.length; i++) {
    var rowData = rows[i];
    var rawId = rowData[idCol];

    if (rawId === "" || rawId === null || rawId === undefined) continue;

    var cleanDigits = String(rawId).replace(/\D+/g, "");
    var currentId = cleanDigits ? parseInt(cleanDigits, 10) : rawId;

    var wardVal = wardCol !== -1 && rowData[wardCol] ? formatFullWardName(rowData[wardCol]) : "Unassigned";
    var zoneVal = zoneCol !== -1 && rowData[zoneCol] ? String(rowData[zoneCol]).trim() : "";

    // Automatic Zone Auto-Fill in Google Sheet if Zone is empty or Unassigned
    if ((!zoneVal || zoneVal.toLowerCase() === "unassigned") && wardVal !== "Unassigned") {
      var autoZ = getZoneFromWard(wardVal);
      if (autoZ) {
        zoneVal = autoZ;
        if (zoneCol !== -1) {
          sheet.getRange(i + 1, zoneCol + 1).setValue(autoZ);
        }
      }
    }

    var patchPayload = {
      "Ward_Name": wardVal,
      "Lat": (latCol !== -1 && rowData[latCol] !== "" && rowData[latCol] !== null && !isNaN(parseFloat(rowData[latCol]))) ? parseFloat(rowData[latCol]) : null,
      "Long": (longCol !== -1 && rowData[longCol] !== "" && rowData[longCol] !== null && !isNaN(parseFloat(rowData[longCol]))) ? parseFloat(rowData[longCol]) : null,
      "Zone": zoneVal ? zoneVal : "Unassigned"
    };

    var patchUrl = SUPABASE_URL + "?Patient_ID=eq." + encodeURIComponent(currentId);
    var patchOptions = {
      'method': 'patch',
      'contentType': 'application/json',
      'headers': {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=representation'
      },
      'payload': JSON.stringify(patchPayload),
      'muteHttpExceptions': true
    };

    try {
      var res = UrlFetchApp.fetch(patchUrl, patchOptions);
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        successCount++;
      }
    } catch (e) {
      Logger.log("Row " + i + " sync error: " + e.toString());
    }
  }

  Logger.log("Bulk Sync Completed! Successfully synced " + successCount + " rows to Supabase.");
}

// =====================================================================
// 2. REAL-TIME AUTO-FILL & SYNC ON EDIT
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
      if (norm === "patient_id" || norm === "id" || norm === "patient_no") idCol = h;
      if (norm === "patient_name" || norm === "name") nameCol = h;
      if (norm === "date") dateCol = h;
      if (norm === "disease") diseaseCol = h;
      if (norm === "ward_name" || norm === "ward" || norm === "prabhag") wardCol = h;
      if (norm === "lat" || norm === "latitude") latCol = h;
      if (norm === "long" || norm === "longitude") longCol = h;
      if (norm === "status") statusCol = h;
      if (norm === "zone") zoneCol = h;
    }

    if (idCol === -1) idCol = 0;
    var rawId = rowValues[idCol];
    if (rawId === "" || rawId === null || rawId === undefined) return;

    var cleanDigits = String(rawId).replace(/\D+/g, "");
    var currentId = cleanDigits ? parseInt(cleanDigits, 10) : rawId;

    var wardVal = wardCol !== -1 ? formatFullWardName(rowValues[wardCol]) : "Unassigned";
    var zoneVal = zoneCol !== -1 && rowValues[zoneCol] ? String(rowValues[zoneCol]).trim() : "";

    // Real-Time Auto-Fill or Clear Zone in Google Sheet if Ward is edited
    if (range.getColumn() === wardCol + 1) {
      if (wardVal && wardVal !== "Unassigned") {
        var autoZ = getZoneFromWard(wardVal);
        if (autoZ && zoneCol !== -1) {
          sheet.getRange(row, zoneCol + 1).setValue(autoZ);
          zoneVal = autoZ;
        }
      } else {
        if (zoneCol !== -1) {
          sheet.getRange(row, zoneCol + 1).setValue("");
          zoneVal = "";
        }
      }
    }

    var patchPayload = {
      "Ward_Name": wardVal,
      "Lat": (latCol !== -1 && rowValues[latCol] !== "" && rowValues[latCol] !== null && !isNaN(parseFloat(rowValues[latCol]))) ? parseFloat(rowValues[latCol]) : null,
      "Long": (longCol !== -1 && rowValues[longCol] !== "" && rowValues[longCol] !== null && !isNaN(parseFloat(rowValues[longCol]))) ? parseFloat(rowValues[longCol]) : null,
      "Zone": zoneVal ? zoneVal : "Unassigned"
    };

    var supabaseUrl = SUPABASE_URL + "?Patient_ID=eq." + encodeURIComponent(currentId);
    var options = {
      'method': 'patch',
      'contentType': 'application/json',
      'headers': {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=representation'
      },
      'payload': JSON.stringify(patchPayload),
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
// 3. RECEIVE FIELD VERIFICATION FROM DASHBOARD APP AND UPDATE GOOGLE SHEET + SUPABASE
// =====================================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getTargetSheet();
    var rows = sheet.getDataRange().getValues();
    var headers = rows[0].map(function(h) { return String(h).trim(); });

    var idCol = -1, zoneCol = -1, wardCol = -1, latCol = -1, longCol = -1, photoCol = -1, statusCol = -1, remarkCol = -1, mobileCol = -1;

    for (var h = 0; h < headers.length; h++) {
      var norm = headers[h].toLowerCase().replace(/\s+/g, '_');
      if (norm === "patient_id" || norm === "id" || norm === "patient_no" || norm.indexOf("patient") !== -1 || norm.indexOf("id") !== -1) {
        if (idCol === -1) idCol = h;
      }
      if (norm === "zone") zoneCol = h;
      if (norm === "ward_name" || norm === "ward" || norm.indexOf("prabhag") !== -1 || norm.indexOf("ward") !== -1) {
        if (wardCol === -1) wardCol = h;
      }
      if (norm === "lat" || norm === "latitude") latCol = h;
      if (norm === "long" || norm === "longitude") longCol = h;
      if (norm === "location_photo_url") photoCol = h;
      if (norm === "verification_status") statusCol = h;
      if (norm === "remark" || norm === "remarks") remarkCol = h;
      if (norm === "user_mobile_number" || norm === "mobile_number" || norm.indexOf("mobile") !== -1) mobileCol = h;
    }

    if (idCol === -1) idCol = 0;
    // अगर Sheet में Remark नाम का हेडर नहीं मिला, तो by default Column J (Index 9) को यूज़ करेगा
    if (remarkCol === -1) remarkCol = 9; 
    // अगर Sheet में User Mobile Number नाम का हेडर नहीं मिला, तो by default Column K (Index 10) को यूज़ करेगा
    if (mobileCol === -1) mobileCol = 10; 

    var autoZone = data.zone || getZoneFromWard(data.wardName);

    for (var i = 1; i < rows.length; i++) {
      var rowCleanId = String(rows[i][idCol]).replace(/\D+/g, "");
      var dataCleanId = String(data.patientId).replace(/\D+/g, "");

      if (rowCleanId && dataCleanId && rowCleanId === dataCleanId) {
        if (autoZone && zoneCol !== -1) sheet.getRange(i + 1, zoneCol + 1).setValue(autoZone);
        if (wardCol !== -1 && data.wardName) sheet.getRange(i + 1, wardCol + 1).setValue(formatFullWardName(data.wardName));
        if (latCol !== -1 && data.lat) sheet.getRange(i + 1, latCol + 1).setValue(data.lat);
        if (longCol !== -1 && data.long) sheet.getRange(i + 1, longCol + 1).setValue(data.long);
        if (photoCol !== -1 && data.locationPhotoUrl) sheet.getRange(i + 1, photoCol + 1).setValue(data.locationPhotoUrl);
        if (statusCol !== -1) sheet.getRange(i + 1, statusCol + 1).setValue("Verified");
        
        // --- ADDED: REMARKS & YELLOW COLOR LOGIC ---
        if (data.remarks && String(data.remarks).trim() !== "") {
          sheet.getRange(i + 1, remarkCol + 1).setValue(data.remarks);
          // Row को Yellow कलर करना
          sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground("#FFFF00"); 
        } else {
          // अगर नार्मल केस है, तो बैकग्राउंड वाइट रखें
          sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()).setBackground("#FFFFFF");
        }
        
        // --- ADDED: MOBILE NUMBER LOGIC ---
        if (data.mobileNumber && String(data.mobileNumber).trim() !== "") {
          sheet.getRange(i + 1, mobileCol + 1).setValue(data.mobileNumber);
        }
        // -------------------------------------------
        break;
      }
    }

    // Direct REST PATCH Sync to Supabase DB from Apps Script Webhook
    try {
      var spCleanId = String(data.patientId).replace(/\D+/g, "");
      var spUrl = SUPABASE_URL + "?Patient_ID=eq." + (spCleanId ? spCleanId : encodeURIComponent(data.patientId));
      var spPayload = {};
      if (data.wardName) spPayload["Ward_Name"] = formatFullWardName(data.wardName);
      if (data.lat) spPayload["Lat"] = parseFloat(data.lat);
      if (data.long) spPayload["Long"] = parseFloat(data.long);
      if (autoZone) spPayload["Zone"] = autoZone;
      
      // ADDED: Sync Remarks to Supabase
      if (data.remarks) spPayload["Remarks"] = data.remarks;
      
      // ADDED: Sync Mobile Number to Supabase
      if (data.mobileNumber) spPayload["Mobile_Number"] = data.mobileNumber;

      UrlFetchApp.fetch(spUrl, {
        "method": "patch",
        "contentType": "application/json",
        "headers": {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY
        },
        "payload": JSON.stringify(spPayload),
        "muteHttpExceptions": true
      });
    } catch (spErr) {
      Logger.log("Supabase sync inside doPost error: " + spErr.toString());
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

## ⚡ How to Auto-Fill All Rows Now:

1. Open Google Sheet ➔ **Extensions** ➔ **Apps Script**.
2. Replace code in `Code.gs` with the snippet above and click **💾 Save**.
3. Select function **`syncAllExistingRows`** in top dropdown menu and click **▶ Run**.
4. **All rows in your Google Sheet will auto-fill instantly!**
