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
// WITH AUTOMATIC TRUE UPSERT ENGINE (CREATES NEW AND UPDATES EXISTING)
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
  "10": "10 Mangalwari", "11": "10 Mangalwari",
  "12": "2 Dharampeth", "13": "2 Dharampeth", "14": "2 Dharampeth", "15": "2 Dharampeth",
  "16": "1 Laxmi Nagar", "17": "4 Dhantoli", "18": "6 Gandhibag", "19": "6 Gandhibag",
  "20": "7 Satranjipura", "21": "7 Satranjipura", "22": "6 Gandhibag", "23": "8 Lakadganj",
  "24": "8 Lakadganj", "25": "8 Lakadganj", "26": "5 Nehru Nagar", "27": "5 Nehru Nagar",
  "28": "5 Nehru Nagar", "29": "3 Hanuman Nagar", "30": "5 Nehru Nagar", "31": "3 Hanuman Nagar",
  "32": "3 Hanuman Nagar", "33": "4 Dhantoli", "34": "3 Hanuman Nagar", "35": "4 Dhantoli",
  "36": "1 Laxmi Nagar", "37": "1 Laxmi Nagar", "38": "1 Laxmi Nagar"
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

// =====================================================================
// 1. BULK SYNC & AUTOMATIC ZONE AUTO-FILL FOR ENTIRE SHEET (UPSERT)
// =====================================================================
function syncAllExistingRows() {
  var sheet = getTargetSheet();
  var rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    Logger.log("Sheet is empty!");
    return;
  }

  var headers = rows[0].map(function(h) { return String(h).trim(); });

  var idCol = -1, nameCol = -1, dateCol = -1, diseaseCol = -1, wardCol = -1, latCol = -1, longCol = -1, statusCol = -1, zoneCol = -1, remarkCol = -1, mobileCol = -1;

  for (var h = 0; h < headers.length; h++) {
    var norm = headers[h].toLowerCase().replace(/\s+/g, '_');
    // FIX: Strict check for Patient ID so it doesn't match Patient Name
    if (norm === "patient_id" || norm === "id" || norm === "patient_no") idCol = h;
    if (norm === "patient_name" || norm === "name") nameCol = h;
    if (norm === "date") dateCol = h;
    if (norm === "disease") diseaseCol = h;
    if (norm === "ward_name" || norm === "ward" || norm.indexOf("prabhag") !== -1 || norm.indexOf("ward") !== -1) wardCol = h;
    if (norm === "lat" || norm === "latitude") latCol = h;
    if (norm === "long" || norm === "longitude") longCol = h;
    if (norm === "status" || norm === "verification_status") statusCol = h;
    if (norm === "zone") zoneCol = h;
    if (norm === "remark" || norm === "remarks") remarkCol = h; 
    if (norm === "user_mobile" || norm === "user_mobile_number" || norm === "mobile_number" || norm.indexOf("mobile") !== -1) mobileCol = h;
  }

  if (idCol === -1) idCol = 0;

  var bulkPayload = [];
  var successCount = 0;

  for (var i = 1; i < rows.length; i++) {
    var rowData = rows[i];
    var rawId = rowData[idCol];

    if (rawId === "" || rawId === null || rawId === undefined) continue;

    var cleanDigits = String(rawId).replace(/\D+/g, "");
    var currentId = cleanDigits ? parseInt(cleanDigits, 10) : rawId;

    var wardVal = wardCol !== -1 && rowData[wardCol] ? formatFullWardName(rowData[wardCol]) : "Unassigned";
    var zoneVal = zoneCol !== -1 && rowData[zoneCol] ? String(rowData[zoneCol]).trim() : "";
    var remarkVal = remarkCol !== -1 && rowData[remarkCol] ? String(rowData[remarkCol]).trim() : ""; 
    var statusVal = statusCol !== -1 && rowData[statusCol] ? String(rowData[statusCol]).trim() : null; 
    var mobileVal = mobileCol !== -1 && rowData[mobileCol] ? String(rowData[mobileCol]).trim() : null; 
    var nameVal = nameCol !== -1 && rowData[nameCol] ? String(rowData[nameCol]).trim() : null;
    var diseaseVal = diseaseCol !== -1 && rowData[diseaseCol] ? String(rowData[diseaseCol]).trim() : null;
    
    // Parse Date properly for Supabase
    var dateVal = null;
    if (dateCol !== -1 && rowData[dateCol]) {
      if (rowData[dateCol] instanceof Date) {
        dateVal = rowData[dateCol].toISOString();
      } else {
        dateVal = String(rowData[dateCol]).trim();
      }
    }

    if ((!zoneVal || zoneVal.toLowerCase() === "unassigned") && wardVal !== "Unassigned") {
      var autoZ = getZoneFromWard(wardVal);
      if (autoZ) {
        zoneVal = autoZ;
        if (zoneCol !== -1) {
          try { sheet.getRange(i + 1, zoneCol + 1).setValue(autoZ); } catch(e) {}
        }
      }
    }

    var payload = {
      "Patient_ID": currentId,
      "Patient_Name": nameVal,
      "Date": dateVal,
      "Disease": diseaseVal,
      "Ward_Name": wardVal,
      "Lat": (latCol !== -1 && rowData[latCol] !== "" && rowData[latCol] !== null && !isNaN(parseFloat(rowData[latCol]))) ? parseFloat(rowData[latCol]) : null,
      "Long": (longCol !== -1 && rowData[longCol] !== "" && rowData[longCol] !== null && !isNaN(parseFloat(rowData[longCol]))) ? parseFloat(rowData[longCol]) : null,
      "Zone": zoneVal ? zoneVal : "Unassigned",
      "Remarks": remarkVal ? remarkVal : null 
    };
    
    if (statusVal) payload["Status"] = statusVal;
    if (mobileVal) payload["Mobile_Number"] = mobileVal;

    bulkPayload.push(payload);
  }

  try {
    var batchSize = 500; 
    for (var b = 0; b < bulkPayload.length; b += batchSize) {
      var chunk = bulkPayload.slice(b, b + batchSize);
      
      var res = UrlFetchApp.fetch(SUPABASE_URL, {
        'method': 'post', 
        'contentType': 'application/json',
        'headers': {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=minimal, resolution=merge-duplicates' 
        },
        'payload': JSON.stringify(chunk),
        'muteHttpExceptions': true
      });
      
      var code = res.getResponseCode();
      if (code !== 200 && code !== 201 && code !== 204) {
         Logger.log("Bulk Sync Supabase Error: " + res.getContentText());
      } else {
         successCount += chunk.length;
      }
    }
  } catch (e) {
    Logger.log("Bulk sync error: " + e.toString());
  }

  Logger.log("Bulk Sync Completed! Successfully upserted " + successCount + " rows to Supabase.");
}

// =====================================================================
// 2. REAL-TIME AUTO-FILL & SYNC ON EDIT (UPSERT)
// =====================================================================
function onSheetEdit(e) {
  if (!e) return;
  var range = e.range;
  var sheet = range.getSheet();
  
  var startRow = range.getRow();
  var numRows = range.getNumRows(); 
  
  if (startRow === 1 && numRows === 1) return;

  try {
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });

    var idCol = -1, nameCol = -1, dateCol = -1, diseaseCol = -1, wardCol = -1, latCol = -1, longCol = -1, zoneCol = -1, remarkCol = -1, mobileCol = -1, statusCol = -1;

    for (var h = 0; h < headers.length; h++) {
      var norm = headers[h].toLowerCase().replace(/\s+/g, '_');
      // FIX: Strict check for Patient ID so it doesn't match Patient Name
      if (norm === "patient_id" || norm === "id" || norm === "patient_no") idCol = h;
      if (norm === "patient_name" || norm === "name") nameCol = h;
      if (norm === "date") dateCol = h;
      if (norm === "disease") diseaseCol = h;
      if (norm === "ward_name" || norm === "ward" || norm.indexOf("prabhag") !== -1 || norm.indexOf("ward") !== -1) wardCol = h;
      if (norm === "lat" || norm === "latitude") latCol = h;
      if (norm === "long" || norm === "longitude") longCol = h;
      if (norm === "zone") zoneCol = h;
      if (norm === "remark" || norm === "remarks") remarkCol = h; 
      if (norm === "status" || norm === "verification_status") statusCol = h;
      if (norm === "user_mobile" || norm === "user_mobile_number" || norm === "mobile_number" || norm.indexOf("mobile") !== -1) mobileCol = h;
    }

    if (idCol === -1) idCol = 0;
    
    var rowValuesArray = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var fetchRequests = [];

    for (var i = 0; i < numRows; i++) {
      var currentRow = startRow + i;
      if (currentRow === 1) continue;

      var rowValues = rowValuesArray[i];
      var rawId = rowValues[idCol];
      if (rawId === "" || rawId === null || rawId === undefined) continue;

      var cleanDigits = String(rawId).replace(/\D+/g, "");
      var currentId = cleanDigits ? parseInt(cleanDigits, 10) : rawId;

      var wardVal = wardCol !== -1 ? formatFullWardName(rowValues[wardCol]) : "Unassigned";
      var zoneVal = zoneCol !== -1 && rowValues[zoneCol] ? String(rowValues[zoneCol]).trim() : "";
      var remarkVal = remarkCol !== -1 && rowValues[remarkCol] ? String(rowValues[remarkCol]).trim() : ""; 
      var statusVal = statusCol !== -1 && rowValues[statusCol] ? String(rowValues[statusCol]).trim() : null; 
      var mobileVal = mobileCol !== -1 && rowValues[mobileCol] ? String(rowValues[mobileCol]).trim() : null; 
      var nameVal = nameCol !== -1 && rowValues[nameCol] ? String(rowValues[nameCol]).trim() : null;
      var diseaseVal = diseaseCol !== -1 && rowValues[diseaseCol] ? String(rowValues[diseaseCol]).trim() : null;

      var dateVal = null;
      if (dateCol !== -1 && rowValues[dateCol]) {
        if (rowValues[dateCol] instanceof Date) {
          dateVal = rowValues[dateCol].toISOString();
        } else {
          dateVal = String(rowValues[dateCol]).trim();
        }
      }

      if (range.getColumn() <= wardCol + 1 && range.getColumn() + range.getNumColumns() - 1 >= wardCol + 1) {
        if (wardVal && wardVal !== "Unassigned") {
          var autoZ = getZoneFromWard(wardVal);
          if (autoZ && zoneCol !== -1) {
            try { sheet.getRange(currentRow, zoneCol + 1).setValue(autoZ); } catch(e) {}
            zoneVal = autoZ;
          }
        } else {
          if (zoneCol !== -1) {
            try { sheet.getRange(currentRow, zoneCol + 1).setValue(""); } catch(e) {}
            zoneVal = "";
          }
        }
      }

      var payload = {
        "Patient_ID": currentId,
        "Patient_Name": nameVal,
        "Date": dateVal,
        "Disease": diseaseVal,
        "Ward_Name": wardVal,
        "Lat": (latCol !== -1 && rowValues[latCol] !== "" && rowValues[latCol] !== null && !isNaN(parseFloat(rowValues[latCol]))) ? parseFloat(rowValues[latCol]) : null,
        "Long": (longCol !== -1 && rowValues[longCol] !== "" && rowValues[longCol] !== null && !isNaN(parseFloat(rowValues[longCol]))) ? parseFloat(rowValues[longCol]) : null,
        "Zone": zoneVal ? zoneVal : "Unassigned",
        "Remarks": remarkVal ? remarkVal : null 
      };
      
      if (statusVal) payload["Status"] = statusVal;
      if (mobileVal) payload["Mobile_Number"] = mobileVal;
      
      fetchRequests.push({
        'url': SUPABASE_URL,
        'method': 'post',
        'contentType': 'application/json',
        'headers': {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=minimal, resolution=merge-duplicates' 
        },
        'payload': JSON.stringify(payload),
        'muteHttpExceptions': true
      });
    }
    
    var batchSize = 50; 
    for (var b = 0; b < fetchRequests.length; b += batchSize) {
      var batch = fetchRequests.slice(b, b + batchSize);
      var responses = UrlFetchApp.fetchAll(batch);
      
      for (var r = 0; r < responses.length; r++) {
         var code = responses[r].getResponseCode();
         if (code !== 200 && code !== 201 && code !== 204) {
            Logger.log("Real-time Sync Supabase Error: " + responses[r].getContentText());
         }
      }
      
      if (b + batchSize < fetchRequests.length) {
        Utilities.sleep(1500); 
      }
    }
    
  } catch (err) {
    Logger.log("Real-time Edit Sync Error: " + err.toString());
  }
}

function onSheetEditTrigger(e) {
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
      
      // FIX: Strict check for Patient ID so it doesn't match Patient Name
      if (norm === "patient_id" || norm === "id" || norm === "patient_no") {
        idCol = h;
      }
      if (norm === "zone") zoneCol = h;
      if (norm === "ward_name" || norm === "ward" || norm.indexOf("prabhag") !== -1 || norm.indexOf("ward") !== -1) {
        wardCol = h;
      }
      if (norm === "lat" || norm === "latitude") latCol = h;
      if (norm === "long" || norm === "longitude") longCol = h;
      if (norm === "location_photo_url") photoCol = h;
      if (norm === "verification_status" || norm === "status") statusCol = h;
      if (norm.indexOf("remark") !== -1) remarkCol = h;
      if (norm.indexOf("mobile") !== -1) mobileCol = h;
    }

    if (idCol === -1) idCol = 0;
    if (mobileCol === -1) mobileCol = 9;  // Column J
    if (remarkCol === -1) remarkCol = 10; // Column K

    var autoZone = data.zone;
    if (!autoZone || autoZone === "Unassigned" || autoZone === "Unknown Zone") {
      autoZone = getZoneFromWard(data.wardName);
    }

    for (var i = 1; i < rows.length; i++) {
      var rowCleanId = String(rows[i][idCol]).replace(/\D+/g, "");
      var dataCleanId = String(data.patientId).replace(/\D+/g, "");

      if (rowCleanId && dataCleanId && rowCleanId === dataCleanId) {
        
        // ** NEW LOGIC: Check if this is an issue report **
        var isIssue = data.action === 'REPORT_ISSUE' || data.isIssue || (data.remarks && String(data.remarks).trim() !== "");

        if (autoZone && zoneCol !== -1 && autoZone !== "Unassigned" && autoZone !== "Unknown Zone") {
          try { sheet.getRange(i + 1, zoneCol + 1).setValue(autoZone); } catch (errIgnore) {}
        }
        
        if (wardCol !== -1 && data.wardName && data.wardName !== "Unassigned" && data.wardName !== "Unknown") {
          try { sheet.getRange(i + 1, wardCol + 1).setValue(formatFullWardName(data.wardName)); } catch (errIgnore) {}
        }
        
        // Update GPS & Photo only if it's NOT an issue
        if (!isIssue) {
          if (latCol !== -1 && data.lat) { try { sheet.getRange(i + 1, latCol + 1).setValue(data.lat); } catch (errIgnore){} }
          if (longCol !== -1 && data.long) { try { sheet.getRange(i + 1, longCol + 1).setValue(data.long); } catch (errIgnore){} }
          if (photoCol !== -1 && data.locationPhotoUrl) { try { sheet.getRange(i + 1, photoCol + 1).setValue(data.locationPhotoUrl); } catch (errIgnore){} }
        }
        
        if (statusCol !== -1) {
          try { sheet.getRange(i + 1, statusCol + 1).setValue(isIssue ? "Flagged/Issue" : "Verified"); } catch (errIgnore) {}
        }
        
        if (isIssue) {
          if (data.remarks && String(data.remarks).trim() !== "") {
            try { sheet.getRange(i + 1, remarkCol + 1).setValue(data.remarks); } catch(errIgnore) {}
          }
          try { sheet.getRange(i + 1, 1, 1, 15).setBackground("#FFFF00"); } catch(errIgnore) {}
        } else {
          try { sheet.getRange(i + 1, 1, 1, 15).setBackground("#FFFFFF"); } catch(errIgnore) {}
        }
        
        if (data.mobileNumber && String(data.mobileNumber).trim() !== "") {
          try { sheet.getRange(i + 1, mobileCol + 1).setValue(data.mobileNumber); } catch(errIgnore) {}
        }
        break;
      }
    }

    // Direct REST PATCH Sync to Supabase DB (Kept as PATCH because dashboard verifications are strictly updates)
    try {
      var spCleanId = String(data.patientId).replace(/\D+/g, "");
      var spUrl = SUPABASE_URL + "?Patient_ID=eq." + (spCleanId ? spCleanId : encodeURIComponent(data.patientId));
      var spPayload = {};
      if (data.wardName && data.wardName !== "Unassigned" && data.wardName !== "Unknown") spPayload["Ward_Name"] = formatFullWardName(data.wardName);
      
      // Update GPS in Supabase ONLY IF it's not an issue
      if (!isIssue) {
        if (data.lat) spPayload["Lat"] = parseFloat(data.lat);
        if (data.long) spPayload["Long"] = parseFloat(data.long);
      }
      
      if (autoZone && autoZone !== "Unassigned" && autoZone !== "Unknown Zone") spPayload["Zone"] = autoZone;
      if (data.remarks) spPayload["Remarks"] = data.remarks;
      if (data.mobileNumber) spPayload["Mobile_Number"] = data.mobileNumber;

      var res = UrlFetchApp.fetch(spUrl, {
        "method": "patch",
        "contentType": "application/json",
        "headers": {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY
        },
        "payload": JSON.stringify(spPayload),
        "muteHttpExceptions": true
      });
      
      var resCode = res.getResponseCode();
      if (resCode !== 200 && resCode !== 204) {
          Logger.log("doPost Supabase Sync Error: " + res.getContentText());
      }
      
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
