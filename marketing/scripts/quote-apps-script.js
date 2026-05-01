/**
 * Lucky Landscapes — Quote Submission Handler
 * Google Apps Script (copy this into script.google.com)
 *
 * What this does:
 * 1. Receives quote form submissions via POST
 * 2. Logs them to a Google Sheet (auto-creates one if needed)
 * 3. Saves uploaded photos to a Google Drive folder
 * 4. Sends an email notification to the team
 *
 * UPDATED: 2026-04-02 — Expanded data capture for all service categories
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
      getConditionDetails(data),
      getPlantDetails(data),
      getCleanupDetails(data),
      getDesignDetails(data),
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
        'Scope/Size', 'Condition/Surface', 'Plant Details', 'Cleanup Details',
        'Design Details', 'Project Description', 'Notes',
        'Contact Preference', 'Best Time', 'Photo Count', 'Photo Links'
      ]);
      // Bold the header row
      sheet.getRange(1, 1, 1, 21).setFontWeight('bold');
      // Auto-resize columns
      for (let i = 1; i <= 21; i++) {
        sheet.setColumnWidth(i, 150);
      }
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
  // Lawn add-ons
  if (data.lawn_edging) services.push('  + Edging');
  if (data.lawn_trimming) services.push('  + String Trimming');
  if (data.lawn_hedges) services.push('  + Hedge Trimming');
  if (data.lawn_blowing) services.push('  + Blowing & Cleanup');

  // Garden — support both field names (garden_planting and garden_transplant)
  if (data.garden_beds) services.push('Garden Beds');
  if (data.garden_mulch) services.push('Mulching');
  if (data.garden_edging) services.push('Bed Edging');
  if (data.garden_planting || data.garden_transplant) services.push('Plant & Transplant');

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
  if (data.cleanup_leaf) services.push('Leaf Removal');
  if (data.cleanup_yard) services.push('Full Yard Cleanup');
  // Cleanup item types
  if (data.cleanup_type_yard_waste) services.push('  └ Yard waste/brush');
  if (data.cleanup_type_construction) services.push('  └ Construction debris');
  if (data.cleanup_type_furniture) services.push('  └ Furniture/household');
  if (data.cleanup_type_appliances) services.push('  └ Appliances');
  if (data.cleanup_type_trees) services.push('  └ Trees/stumps');
  if (data.cleanup_type_general) services.push('  └ General junk');

  // Design areas
  if (data.design_front) services.push('Front Yard');
  if (data.design_back) services.push('Backyard');
  if (data.design_full) services.push('Full Property');
  // Design elements
  if (data.design_el_plants) services.push('  └ Plants & Trees');
  if (data.design_el_beds) services.push('  └ Garden Beds');
  if (data.design_el_pavers) services.push('  └ Pavers');
  if (data.design_el_walls) services.push('  └ Retaining Walls');
  if (data.design_el_lighting) services.push('  └ Lighting');
  if (data.design_el_water) services.push('  └ Water Features');
  if (data.design_el_other) services.push('  └ Other');

  // Custom project checkboxes
  if (data.custom_mowing) services.push('Custom: Mowing');
  if (data.custom_cleanup) services.push('Custom: Cleanup');
  if (data.custom_beds) services.push('Custom: Garden Beds');
  if (data.custom_edging) services.push('Custom: Edging');
  if (data.custom_planting) services.push('Custom: Planting');
  if (data.custom_pavers) services.push('Custom: Pavers');
  if (data.custom_retaining) services.push('Custom: Retaining Walls');
  if (data.custom_junk) services.push('Custom: Junk Removal');
  if (data.custom_other) services.push('Custom: Other');

  return services.join(', ');
}

// ===== HELPER: Extract material selections =====
function getMaterials(data) {
  const materials = [];
  if (data.hard_paver_material) materials.push('Paver: ' + data.hard_paver_material);
  if (data.hard_wall_material) materials.push('Wall: ' + data.hard_wall_material);
  if (data.hard_outdoor_material) materials.push('Outdoor: ' + data.hard_outdoor_material);
  if (data.garden_edging_material) materials.push('Edging: ' + data.garden_edging_material);
  if (data.garden_mulch_color) materials.push('Mulch Color: ' + data.garden_mulch_color);
  if (data.garden_mulch_depth) materials.push('Mulch Depth: ' + data.garden_mulch_depth);
  if (data.garden_material) materials.push('Garden: ' + data.garden_material);
  if (data.hard_paver_pattern) materials.push('Pattern: ' + data.hard_paver_pattern);
  return materials.join(' | ');
}

// ===== HELPER: Extract scope/size details =====
function getScopeDetails(data) {
  const scope = [];
  if (data.hard_scope) scope.push('Size: ' + data.hard_scope);
  if (data.hard_wall_height) scope.push('Wall Height: ' + data.hard_wall_height);
  if (data.hard_wall_length) scope.push('Wall Length: ' + data.hard_wall_length);
  if (data.hard_wall_purpose) scope.push('Wall Purpose: ' + data.hard_wall_purpose);
  if (data.hard_wall_existing) scope.push('Existing Wall: ' + data.hard_wall_existing);
  if (data.hard_outdoor_covered) scope.push('Covered: ' + data.hard_outdoor_covered);
  if (data.hard_outdoor_budget) scope.push('Outdoor Budget: ' + data.hard_outdoor_budget);
  if (data.hard_outdoor_existing) scope.push('Existing Patio: ' + data.hard_outdoor_existing);
  if (data.lawn_size) scope.push('Lawn Size: ' + data.lawn_size);
  if (data.lawn_frequency) scope.push('Frequency: ' + data.lawn_frequency);
  if (data.lawn_condition) scope.push('Condition: ' + data.lawn_condition);
  if (data.garden_scope) scope.push('Garden Scope: ' + data.garden_scope);
  if (data.garden_beds_count) scope.push('# Beds: ' + data.garden_beds_count);
  if (data.design_budget) scope.push('Budget: ' + data.design_budget);
  if (data.design_style) scope.push('Style: ' + data.design_style);
  if (data.design_timeline) scope.push('Timeline: ' + data.design_timeline);
  if (data.cleanup_size) scope.push('Cleanup Size: ' + data.cleanup_size);
  if (data.cleanup_urgency) scope.push('Urgency: ' + data.cleanup_urgency);
  if (data.cleanup_access) scope.push('Access: ' + data.cleanup_access);
  return scope.join(' | ');
}

// ===== HELPER: Extract condition/surface details =====
function getConditionDetails(data) {
  const details = [];
  if (data.hard_paver_surface) details.push('Surface: ' + data.hard_paver_surface);
  if (data.hard_paver_removal) details.push('Removal: ' + data.hard_paver_removal);
  if (data.hard_paver_drainage) details.push('Drainage: ' + data.hard_paver_drainage);
  return details.join(' | ');
}

// ===== HELPER: Extract plant details =====
function getPlantDetails(data) {
  const details = [];
  if (data.garden_plant_count) details.push('Count: ' + data.garden_plant_count);
  if (data.garden_plant_size) details.push('Size: ' + data.garden_plant_size);
  if (data.garden_plant_source) details.push('Source: ' + data.garden_plant_source);
  // Plant types
  const types = [];
  if (data.garden_plant_shrubs) types.push('Shrubs');
  if (data.garden_plant_trees) types.push('Trees');
  if (data.garden_plant_perennials) types.push('Perennials');
  if (data.garden_plant_annuals) types.push('Annuals');
  if (data.garden_plant_grasses) types.push('Grasses');
  if (data.garden_plant_other) types.push('Other');
  if (types.length > 0) details.push('Types: ' + types.join(', '));
  return details.join(' | ');
}

// ===== HELPER: Extract cleanup details =====
function getCleanupDetails(data) {
  const details = [];
  if (data.cleanup_dumpster) details.push('Dumpster: ' + data.cleanup_dumpster);
  if (data.cleanup_recurring) details.push('Recurring: ' + data.cleanup_recurring);
  if (data.cleanup_property_type) details.push('Property: ' + data.cleanup_property_type);
  return details.join(' | ');
}

// ===== HELPER: Extract design context details =====
function getDesignDetails(data) {
  const details = [];
  if (data.design_property_age) details.push('Property Age: ' + data.design_property_age);
  if (data.design_existing_landscape) details.push('Current: ' + data.design_existing_landscape);
  if (data.design_hoa) details.push('HOA: ' + data.design_hoa);
  if (data.design_irrigation) details.push('Irrigation: ' + data.design_irrigation);
  if (data.design_pets_kids) details.push('Pets/Kids: ' + data.design_pets_kids);
  if (data.design_sun_exposure) details.push('Sun: ' + data.design_sun_exposure);
  return details.join(' | ');
}

// ===== EMAIL NOTIFICATION =====
function sendNotificationEmail(data, photoLinks) {
  const clientName = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();

  const subject = `🍀 New Quote Request — ${data.categoryLabel || data.category || 'General'} — ${clientName}`;

  let body = `
NEW QUOTE REQUEST
==================

CLIENT INFORMATION
------------------
Name: ${clientName}
Email: ${data.email || 'N/A'}
Phone: ${data.phone || 'N/A'}
Address: ${data.address || 'Not provided'}
Contact Preference: ${data.contactMethod || 'Any'}
Best Time: ${data.bestTime || 'Anytime'}

PROJECT OVERVIEW
----------------
Category: ${data.categoryLabel || data.category || 'N/A'}
Project Type: ${data.projectType || 'N/A'}

SERVICES REQUESTED
------------------
${getCheckedServices(data) || 'N/A'}

MATERIALS & PREFERENCES
-----------------------
${getMaterials(data) || 'N/A'}

SCOPE & SIZING
--------------
${getScopeDetails(data) || 'N/A'}

CONDITION & SURFACE
-------------------
${getConditionDetails(data) || 'N/A'}

PLANT DETAILS
-------------
${getPlantDetails(data) || 'N/A'}

CLEANUP DETAILS
---------------
${getCleanupDetails(data) || 'N/A'}

DESIGN CONTEXT
--------------
${getDesignDetails(data) || 'N/A'}

PROJECT DESCRIPTION
-------------------
${data.project_description || 'Not provided'}

ADDITIONAL NOTES
----------------
${data.notes || 'None'}

PHOTOS
------
${data.photoCount || '0'} uploaded
${photoLinks ? 'Photo links:\n' + photoLinks : 'No photos attached'}

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
