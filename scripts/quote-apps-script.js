/**
 * Lucky Landscapes — Quote Submission Handler
 * Google Apps Script (copy this into script.google.com)
 *
 * What this does:
 * 1. Receives quote form submissions via POST
 * 2. Logs them to a Google Sheet (auto-creates one if needed)
 * 3. Saves uploaded photos to a Google Drive folder
 * 4. Sends an email notification to the team
 */

// ===== CONFIG =====
const NOTIFICATION_EMAIL = 'rileykopf@luckylandscapes.com';
const SHEET_NAME = 'Quote Submissions';
const DRIVE_FOLDER_NAME = 'Lucky Landscapes — Quote Photos';

// ===== MAIN HANDLER =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Get or create the spreadsheet
    const sheet = getOrCreateSheet();

    // Handle photo uploads to Drive
    let photoLinks = '';
    if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
      const folder = getOrCreateFolder();
      const timestamp = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd_HH-mm');
      const clientName = (data.firstName || '') + ' ' + (data.lastName || '');
      const links = [];

      data.photos.forEach((photo, idx) => {
        try {
          const blob = Utilities.newBlob(
            Utilities.base64Decode(photo.data),
            photo.type,
            `${clientName.trim()}_${timestamp}_${idx + 1}_${photo.name}`
          );
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          links.push(file.getUrl());
        } catch (photoErr) {
          Logger.log('Photo upload error: ' + photoErr.message);
        }
      });

      photoLinks = links.join('\n');
    }

    // Remove photos array from data before logging (too large for sheet)
    delete data.photos;

    // Build the row
    const timestamp = Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy hh:mm a');
    const row = [
      timestamp,
      data.firstName || '',
      data.lastName || '',
      data.email || '',
      data.phone || '',
      data.address || '',
      data.categoryLabel || data.category || '',
      data.projectType || '',
      getCheckedServices(data),
      getMaterials(data),
      getScopeDetails(data),
      data.project_description || '',
      data.notes || '',
      data.contactMethod || 'any',
      data.bestTime || 'anytime',
      data.photoCount || '0',
      photoLinks
    ];

    // Ensure headers exist
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'First Name', 'Last Name', 'Email', 'Phone', 'Address',
        'Category', 'Project Type', 'Services Selected', 'Materials',
        'Scope/Size', 'Project Description', 'Notes',
        'Contact Preference', 'Best Time', 'Photo Count', 'Photo Links'
      ]);
      // Bold the header row
      sheet.getRange(1, 1, 1, 17).setFontWeight('bold');
    }

    sheet.appendRow(row);

    // Send email notification
    sendNotificationEmail(data, photoLinks);

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'success' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('Error: ' + err.message);
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== HELPER: Extract checked services =====
function getCheckedServices(data) {
  const services = [];
  // Lawn care
  if (data.lawn_mowing) services.push('Mowing');
  if (data.lawn_cleanup) services.push('Seasonal Cleanup');
  if (data.lawn_leaf) services.push('Leaf Removal');
  if (data.lawn_complete) services.push('Complete Package');
  // Garden
  if (data.garden_beds) services.push('Garden Beds');
  if (data.garden_mulch) services.push('Mulching');
  if (data.garden_edging) services.push('Edging');
  if (data.garden_transplant) services.push('Plant Transplant');
  // Hardscaping
  if (data.hard_pavers) services.push('Pavers');
  if (data.hard_retaining) services.push('Retaining Walls');
  if (data.hard_outdoor) services.push('Outdoor Living');
  // Paver sub-types
  if (data.hard_paver_patio) services.push('  └ Patio');
  if (data.hard_paver_driveway) services.push('  └ Driveway');
  if (data.hard_paver_walkway) services.push('  └ Walkway');
  if (data.hard_paver_pool) services.push('  └ Pool Deck');
  // Outdoor living sub-types
  if (data.hard_outdoor_firepit) services.push('  └ Fire Pit');
  if (data.hard_outdoor_fireplace) services.push('  └ Outdoor Fireplace');
  if (data.hard_outdoor_kitchen) services.push('  └ Kitchen/Grill');
  if (data.hard_outdoor_seating) services.push('  └ Seating Wall');
  if (data.hard_outdoor_pergola) services.push('  └ Pergola/Arbor');
  if (data.hard_outdoor_other) services.push('  └ Other Feature');
  // Cleanup
  if (data.cleanup_junk) services.push('Junk Removal');
  if (data.cleanup_debris) services.push('Debris Hauling');
  if (data.cleanup_overgrown) services.push('Overgrown Yard');
  if (data.cleanup_demolition) services.push('Light Demolition');
  return services.join(', ');
}

// ===== HELPER: Extract material selections =====
function getMaterials(data) {
  const materials = [];
  if (data.hard_paver_material) materials.push('Paver: ' + data.hard_paver_material);
  if (data.hard_wall_material) materials.push('Wall: ' + data.hard_wall_material);
  if (data.hard_outdoor_material) materials.push('Outdoor: ' + data.hard_outdoor_material);
  if (data.garden_edging_material) materials.push('Edging: ' + data.garden_edging_material);
  if (data.garden_mulch_color) materials.push('Mulch: ' + data.garden_mulch_color);
  return materials.join(' | ');
}

// ===== HELPER: Extract scope/size details =====
function getScopeDetails(data) {
  const scope = [];
  if (data.hard_scope) scope.push('Size: ' + data.hard_scope);
  if (data.hard_wall_height) scope.push('Wall Height: ' + data.hard_wall_height);
  if (data.hard_wall_length) scope.push('Wall Length: ' + data.hard_wall_length);
  if (data.hard_outdoor_covered) scope.push('Covered: ' + data.hard_outdoor_covered);
  if (data.lawn_size) scope.push('Lawn Size: ' + data.lawn_size);
  if (data.lawn_frequency) scope.push('Frequency: ' + data.lawn_frequency);
  if (data.design_budget) scope.push('Budget: ' + data.design_budget);
  return scope.join(' | ');
}

// ===== EMAIL NOTIFICATION =====
function sendNotificationEmail(data, photoLinks) {
  const clientName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();

  const subject = `🍀 New Quote Request — ${data.categoryLabel || data.category || 'General'} — ${clientName}`;

  let body = `
NEW QUOTE REQUEST
==================

Client: ${clientName}
Email: ${data.email || 'N/A'}
Phone: ${data.phone || 'N/A'}
Address: ${data.address || 'Not provided'}

Category: ${data.categoryLabel || data.category || 'N/A'}
Project Type: ${data.projectType || 'N/A'}

Services: ${getCheckedServices(data) || 'N/A'}
Materials: ${getMaterials(data) || 'N/A'}
Scope: ${getScopeDetails(data) || 'N/A'}

Project Description:
${data.project_description || 'Not provided'}

Additional Notes:
${data.notes || 'None'}

Contact Preference: ${data.contactMethod || 'Any'}
Best Time: ${data.bestTime || 'Anytime'}

Photos: ${data.photoCount || '0'} uploaded
${photoLinks ? 'Photo links:\n' + photoLinks : ''}

==================
Submitted: ${Utilities.formatDate(new Date(), 'America/Chicago', 'MM/dd/yyyy hh:mm a')}
  `.trim();

  MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

// ===== SHEET MANAGEMENT =====
function getOrCreateSheet() {
  const files = DriveApp.getFilesByName(SHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next()).getActiveSheet();
  }
  const ss = SpreadsheetApp.create(SHEET_NAME);
  return ss.getActiveSheet();
}

// ===== DRIVE FOLDER MANAGEMENT =====
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

// ===== TEST (run manually to verify setup) =====
function testSetup() {
  const sheet = getOrCreateSheet();
  Logger.log('Sheet ready: ' + sheet.getParent().getUrl());
  const folder = getOrCreateFolder();
  Logger.log('Folder ready: ' + folder.getUrl());
  Logger.log('Email will be sent to: ' + NOTIFICATION_EMAIL);
  Logger.log('Setup looks good! Deploy as web app to start receiving quotes.');
}
