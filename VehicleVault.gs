// ============================================================
// LUX AUTO — Vehicle Vault  |  Google Drive Per-Vehicle Folder Management
// Google Apps Script
//
// Script Properties required:
//   SPREADSHEET_ID      — target spreadsheet
//   VAULT_ROOT_FOLDER_ID — root "Vehicle Vault" folder (set on first run)
//
// Entry points:
//   setupVaultRoot()                              — one-time setup
//   createVehicleFolderIfMissing(vin,make,model,year)
//   getVehicleFolder(vin)
//   getVaultContents(vin)
//   storeVaultFolderId(vin, folderId)
//   getVaultSummary()
// ============================================================

const VAULT_ROOT_NAME      = '🚗 Lux Auto - Vehicle Vault';
const VAULT_SUBFOLDER_NAMES = [
  'Condition Report',
  'Carfax',
  'Photos',
  'Title & DMV',
  'Recon',
  'Sale Docs',
];

// ── Sheet name for Pipeline (stores Drive Folder ID column) ──────────────────
const PIPELINE_SHEET_NAME    = 'Pipeline';
const PIPELINE_VIN_COL       = 1;   // column A
const PIPELINE_DRIVE_FOLDER_COL = 20; // column T — "Drive Folder ID"

// ── Root Folder Setup ─────────────────────────────────────────────────────────

/**
 * Finds or creates the root "Vehicle Vault" folder in Drive.
 * Saves the folder ID to Script Properties under VAULT_ROOT_FOLDER_ID.
 * Safe to call repeatedly — idempotent.
 *
 * @returns {string} The Drive folder ID of the vault root.
 */
function setupVaultRoot() {
  const props    = PropertiesService.getScriptProperties();
  const existing = props.getProperty('VAULT_ROOT_FOLDER_ID');

  // Validate the stored ID still resolves
  if (existing) {
    try {
      const folder = DriveApp.getFolderById(existing);
      if (folder && !folder.isTrashed()) {
        Logger.log('VehicleVault: root folder already exists — ' + folder.getUrl());
        return existing;
      }
    } catch (e) {
      Logger.log('VehicleVault: stored root folder ID invalid, recreating');
    }
  }

  // Search for an existing folder by name in root
  const iter = DriveApp.getFoldersByName(VAULT_ROOT_NAME);
  if (iter.hasNext()) {
    const folder = iter.next();
    const id     = folder.getId();
    props.setProperty('VAULT_ROOT_FOLDER_ID', id);
    Logger.log('VehicleVault: found existing root folder — ' + folder.getUrl());
    return id;
  }

  // Create fresh
  const newFolder = DriveApp.createFolder(VAULT_ROOT_NAME);
  const id        = newFolder.getId();
  props.setProperty('VAULT_ROOT_FOLDER_ID', id);
  Logger.log('VehicleVault: created root folder — ' + newFolder.getUrl());
  return id;
}

/**
 * Returns the Drive Folder object for the vault root.
 * Calls setupVaultRoot() if not yet initialized.
 *
 * @returns {Folder}
 */
function _getVaultRoot() {
  const rootId = setupVaultRoot();
  return DriveApp.getFolderById(rootId);
}

// ── Per-Vehicle Folder Management ─────────────────────────────────────────────

/**
 * Finds or creates a subfolder for the given vehicle inside the vault root.
 * Folder name format: "[YEAR] [MAKE] [MODEL] - [VIN]"
 * Also ensures all standard subfolders exist inside it.
 *
 * @param {string} vin
 * @param {string} make
 * @param {string} model
 * @param {string|number} year
 * @returns {{ folderId: string, folderUrl: string, subfolders: Object }}
 */
function createVehicleFolderIfMissing(vin, make, model, year) {
  if (!vin) throw new Error('VehicleVault.createVehicleFolderIfMissing: VIN is required');

  const root       = _getVaultRoot();
  const folderName = year + ' ' + make + ' ' + model + ' - ' + vin;

  // Check if folder already exists under root
  const existing = root.getFoldersByName(folderName);
  let vehicleFolder;

  if (existing.hasNext()) {
    vehicleFolder = existing.next();
    Logger.log('VehicleVault: folder exists for VIN ' + vin);
  } else {
    vehicleFolder = root.createFolder(folderName);
    Logger.log('VehicleVault: created folder for VIN ' + vin + ' — ' + vehicleFolder.getUrl());
  }

  // Ensure all standard subfolders exist
  const subfolders = {};
  VAULT_SUBFOLDER_NAMES.forEach(function(subName) {
    const subIter = vehicleFolder.getFoldersByName(subName);
    const sub     = subIter.hasNext() ? subIter.next() : vehicleFolder.createFolder(subName);
    subfolders[subName] = sub.getId();
  });

  const folderId  = vehicleFolder.getId();
  const folderUrl = vehicleFolder.getUrl();

  // Persist folder ID back to the Pipeline sheet
  storeVaultFolderId(vin, folderId);

  return { folderId, folderUrl, subfolders };
}

/**
 * Searches the vault root for a folder whose name contains the given VIN.
 *
 * @param {string} vin
 * @returns {{ folderId: string, folderUrl: string }|null}
 */
function getVehicleFolder(vin) {
  if (!vin) return null;
  const root = _getVaultRoot();
  const iter = root.getFolders();

  while (iter.hasNext()) {
    const folder = iter.next();
    if (folder.getName().indexOf(vin) !== -1 && !folder.isTrashed()) {
      return {
        folderId  : folder.getId(),
        folderUrl : folder.getUrl(),
      };
    }
  }

  Logger.log('VehicleVault: no folder found for VIN ' + vin);
  return null;
}

// ── File Listing ──────────────────────────────────────────────────────────────

/**
 * Returns all files in the vehicle folder and its standard subfolders.
 *
 * @param {string} vin
 * @returns {Array<{ name: string, url: string, mimeType: string, createdDate: string, subfolder: string }>}
 */
function getVaultContents(vin) {
  const folderInfo = getVehicleFolder(vin);
  if (!folderInfo) return [];

  const vehicleFolder = DriveApp.getFolderById(folderInfo.folderId);
  const files         = [];

  // Files directly in the vehicle folder (root level)
  _collectFiles(vehicleFolder, 'Root', files);

  // Files in each standard subfolder
  const subIter = vehicleFolder.getFolders();
  while (subIter.hasNext()) {
    const sub = subIter.next();
    if (!sub.isTrashed()) {
      _collectFiles(sub, sub.getName(), files);
    }
  }

  return files;
}

/**
 * Helper — pushes file metadata from a folder into the accumulator array.
 *
 * @param {Folder} folder
 * @param {string} subfolderLabel
 * @param {Array}  accumulator
 */
function _collectFiles(folder, subfolderLabel, accumulator) {
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const file = iter.next();
    if (!file.isTrashed()) {
      accumulator.push({
        name        : file.getName(),
        url         : file.getUrl(),
        mimeType    : file.getMimeType(),
        createdDate : file.getDateCreated().toISOString(),
        subfolder   : subfolderLabel,
      });
    }
  }
}

// ── Pipeline Sheet Integration ────────────────────────────────────────────────

/**
 * Writes the Drive folder ID into the Pipeline sheet for the given VIN.
 * Looks for a "Drive Folder ID" column header; creates it if absent.
 *
 * @param {string} vin
 * @param {string} folderId
 */
function storeVaultFolderId(vin, folderId) {
  try {
    const props = PropertiesService.getScriptProperties();
    const ssId  = props.getProperty('SPREADSHEET_ID');
    if (!ssId) { Logger.log('VehicleVault: no SPREADSHEET_ID — skipping storeVaultFolderId'); return; }

    const ss    = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(PIPELINE_SHEET_NAME);
    if (!sheet) { Logger.log('VehicleVault: Pipeline sheet not found'); return; }

    const headers     = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let   driveFolCol = headers.indexOf('Drive Folder ID') + 1;

    // Create the column header if it doesn't exist yet
    if (driveFolCol === 0) {
      driveFolCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, driveFolCol).setValue('Drive Folder ID')
           .setBackground('#37474f').setFontColor('#fff').setFontWeight('bold');
    }

    // Find the row with the matching VIN
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const vinValues = sheet.getRange(2, PIPELINE_VIN_COL, lastRow - 1, 1).getValues();

    for (let i = 0; i < vinValues.length; i++) {
      if (String(vinValues[i][0]).trim() === vin.trim()) {
        sheet.getRange(i + 2, driveFolCol).setValue(folderId);
        Logger.log('VehicleVault: stored folder ID for VIN ' + vin + ' in row ' + (i + 2));
        return;
      }
    }
    Logger.log('VehicleVault: VIN ' + vin + ' not found in Pipeline sheet');
  } catch (err) {
    Logger.log('VehicleVault.storeVaultFolderId error: ' + err.message);
  }
}

// ── Vault Summary ─────────────────────────────────────────────────────────────

/**
 * Returns aggregate statistics about the entire Vehicle Vault.
 *
 * @returns {{
 *   totalVehicles: number,
 *   totalFiles: number,
 *   totalStorageBytes: number,
 *   recentlyAdded: Array<{ vin: string, make: string, model: string, folderUrl: string }>
 * }}
 */
function getVaultSummary() {
  const root          = _getVaultRoot();
  let   totalVehicles = 0;
  let   totalFiles    = 0;
  let   totalBytes    = 0;
  const recentFolders = [];

  const folderIter = root.getFolders();
  while (folderIter.hasNext()) {
    const folder = folderIter.next();
    if (folder.isTrashed()) continue;

    totalVehicles++;

    // Parse VIN, make, model from folder name "[YEAR] [MAKE] [MODEL] - [VIN]"
    const nameParts = folder.getName().split(' - ');
    const vin       = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : '';
    const titleParts = (nameParts[0] || '').trim().split(' ');
    const year      = titleParts[0] || '';
    const make      = titleParts[1] || '';
    const model     = titleParts.slice(2).join(' ') || '';

    recentFolders.push({
      vin,
      make,
      model,
      year,
      folderUrl   : folder.getUrl(),
      createdDate : folder.getDateCreated(),
    });

    // Count files in this folder tree
    const fileIter = folder.getFiles();
    while (fileIter.hasNext()) {
      const file = fileIter.next();
      if (!file.isTrashed()) {
        totalFiles++;
        totalBytes += file.getSize();
      }
    }
    const subIter = folder.getFolders();
    while (subIter.hasNext()) {
      const sub     = subIter.next();
      const sfIter  = sub.getFiles();
      while (sfIter.hasNext()) {
        const file = sfIter.next();
        if (!file.isTrashed()) {
          totalFiles++;
          totalBytes += file.getSize();
        }
      }
    }
  }

  // Sort by creation date descending; return the 10 most recently added
  recentFolders.sort(function(a, b) {
    return b.createdDate.getTime() - a.createdDate.getTime();
  });
  const recentlyAdded = recentFolders.slice(0, 10).map(function(f) {
    return { vin: f.vin, make: f.make, model: f.model, folderUrl: f.folderUrl };
  });

  return {
    totalVehicles,
    totalFiles,
    totalStorageBytes : totalBytes,
    recentlyAdded,
  };
}
