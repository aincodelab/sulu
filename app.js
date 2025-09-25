/************************************************************
 * KONFIGURASI
 ************************************************************/
const SHEET_ID   = "1Q5XTsDqM3y7gfJ6Fdnfg_FxlVAvu2xyDsFViTbjc5AQ"; 
const SHEET_NAME = "Sheet1";                                      
const COL_UNIQUE = ""; // Nomor kolom unik (1=A,2=B,...)

/************************************************************
 * ENDPOINT
 ************************************************************/
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const map = { create, read, update, del };
    if (!map[req.action]) throw new Error("Action tidak dikenali");
    return jsonOut(map[req.action](req));
  } catch (err) {
    return jsonOut({ success: false, message: err.message });
  }
}

/************************************************************
 * HELPER UMUM
 ************************************************************/
const sheet = () => SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

// Ambil header yang tidak kosong + trim
function getHeaders() {
  const raw = sheet()
    .getRange(1, 1, 1, sheet().getLastColumn())
    .getDisplayValues()[0]
    .map(v => v.toString().trim());
  return raw.filter(h => h !== "");
}

// Format 1 baris: [id, ...data]
function formatRow(rowValues, index) {
  return [index, ...rowValues.map(v => v.toString().trim())];
}

// Ambil 1 baris lengkap berdasarkan nomor baris
function fetchRow(rowNum) {
  const s   = sheet();
  const hdr = getHeaders();
  const row = s.getRange(rowNum, 1, 1, hdr.length)
               .getDisplayValues()[0]
               .map(v => v.toString().trim());
  return formatRow(row, rowNum);
}

// Cek nilai unik di kolom tertentu, lewati baris skipRow jika diset
function isUnique(value, skipRow = null) {
  const s = sheet();
  const lastRow = s.getLastRow();
  if (lastRow < 2) return true;
  const vals = s.getRange(2, COL_UNIQUE, lastRow - 1, 1)
                .getDisplayValues()
                .flat()
                .map(v => v.toString().trim());
  return !vals.some((v, i) => (i + 2 !== skipRow && v === value));
}

// JSON output
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/************************************************************
 * CRUD
 ************************************************************/

// CREATE
function create({ fields }) {
  const s = sheet();
  const hdr = getHeaders();
  const uniqHead  = hdr[COL_UNIQUE - 1];
  const uniqValue = (fields?.[uniqHead] || "").toString().trim();

  if (uniqValue && !isUnique(uniqValue)) {
    return { success: false, message: `${uniqHead} sudah ada, harus unik` };
  }

  const newRow = hdr.map(h => (fields?.[h] ?? "").toString().trim());
  s.appendRow(newRow);

  const id      = s.getLastRow();
  const records = uniqValue ? [ formatRow(newRow, id) ] : [];
  return { 
    success: true, 
    fields: ["id", ...hdr], 
    records,
    totalRecords: records.length 
  };
}

// READ (dengan pagination)
function read({ startRow = 2, limit = 10000 } = {}) {
  const s   = sheet();
  const hdr = getHeaders();
  const lastRow = s.getLastRow();
  
  if (lastRow < 2 || startRow > lastRow) {
    return { 
      success: true, 
      fields: ["id", ...hdr], 
      records: [], 
      totalRecords: 0 
    };
  }

  const rowCount = Math.min(limit, lastRow - startRow + 1);

  const values = s
    .getRange(startRow, 1, rowCount, hdr.length)
    .getDisplayValues()
    .map(r => r.map(v => v.toString().trim()));

  const records = values
    .map((r, i) => ({ r, idx: startRow + i }))
    .filter(o => o.r[COL_UNIQUE - 1] !== "")
    .map(o => formatRow(o.r, o.idx));

  return { 
    success: true, 
    fields: ["id", ...hdr], 
    records,
    totalRecords: records.length 
  };
}

// UPDATE
function update({ id, fields }) {
  const row = Number(id);
  const s   = sheet();
  const hdr = getHeaders();
  if (row <= 1 || row > s.getLastRow()) {
    return { success: false, message: "ID/baris tidak valid" };
  }

  const uniqHead = hdr[COL_UNIQUE - 1];
  if (fields?.[uniqHead] &&
      !isUnique(fields[uniqHead].toString().trim(), row)) {
    return { success: false, message: `${uniqHead} sudah ada, harus unik` };
  }

  // Update seluruh kolom sesuai fields
  hdr.forEach((h, i) => {
    if (fields?.hasOwnProperty(h)) {
      s.getRange(row, i + 1).setValue(fields[h].toString().trim());
    }
  });

  const uniqVal = s.getRange(row, COL_UNIQUE).getDisplayValue().toString().trim();
  const records = uniqVal ? [ fetchRow(row) ] : [];
  return { 
    success: true, 
    fields: ["id", ...hdr], 
    records,
    totalRecords: records.length 
  };
}

// DELETE
function del({ id }) {
  const row = Number(id);
  const s   = sheet();
  const hdr = getHeaders();
  if (row <= 1 || row > s.getLastRow()) {
    return { success: false, message: "ID/baris tidak valid" };
  }

  const uniqVal = s.getRange(row, COL_UNIQUE).getDisplayValue().toString().trim();
  const records = uniqVal ? [ fetchRow(row) ] : [];
  s.deleteRow(row);

  return { 
    success: true, 
    fields: ["id", ...hdr], 
    records,
    totalRecords: records.length 
  };
}
