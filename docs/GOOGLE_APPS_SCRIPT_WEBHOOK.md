# Google Apps Script Setup Guide - Bi-Directional Google Sheet Sync

Follow this guide to enable automatic updates in your Google Sheet whenever a Zone Officer verifies a patient's **GPS Location (Lat/Long)**, **Ward (Prabhag) Name**, or **Location Photo**.

---

## 🛠️ Step 1: Open Google Apps Script Editor

1. Open your Google Sheet: [NMC Health Dashboard Sheet](https://docs.google.com/spreadsheets/d/11Aug_nmc_health_dashboard/edit)
2. Click **Extensions** ➔ **Apps Script**.

---

## 📝 Step 2: Paste the Sync Webhook Code

Paste the following Apps Script code into `Code.gs`:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var rows = sheet.getDataRange().getValues();
    var headers = rows[0];
    
    // Find column indexes
    var idCol = headers.indexOf("Patient_ID");
    var zoneCol = headers.indexOf("Zone");
    var wardCol = headers.indexOf("Ward_Name");
    var latCol = headers.indexOf("Lat");
    var longCol = headers.indexOf("Long");
    var photoCol = headers.indexOf("Location_Photo_Url");
    var statusCol = headers.indexOf("Verification_Status");
    
    if (idCol === -1) idCol = 0; // Default to Column A if header not exact
    
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
6. Set `NEXT_PUBLIC_GOOGLE_SHEET_WEBHOOK_URL` in `.env.local` or Vercel Environment Variables.
