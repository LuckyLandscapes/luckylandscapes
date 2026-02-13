/**
 * ============================================================
 * LUCKY LANDSCAPES — Contact Form Google Apps Script
 * ============================================================
 *
 * HOW TO SET UP:
 * 1. Go to https://sheets.google.com and create a new spreadsheet
 * 2. Name it "Lucky Landscapes — Quotes"
 * 3. Add headers in Row 1: Timestamp | First Name | Last Name | Email | Phone | Service | Message
 * 4. Go to Extensions → Apps Script
 * 5. Delete the default code and paste this entire file
 * 6. Update the EMAIL_TO variable below with your email
 * 7. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy the deployment URL
 * 9. Paste it into main.js as the CONTACT_SCRIPT_URL value
 *
 * IMPORTANT: After pasting, click Deploy → Manage deployments → Edit → Update
 *            every time you make changes to this script.
 * ============================================================
 */

// ---- CONFIG ----
const EMAIL_TO = 'rileykopf@luckylandscapes.com';
const EMAIL_SUBJECT = '🍀 New Quote Request — Lucky Landscapes';

// ---- HANDLERS ----

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // Append row to sheet
        sheet.appendRow([
            new Date().toLocaleString(),
            data.firstName || '',
            data.lastName || '',
            data.email || '',
            data.phone || '',
            data.service || '',
            data.message || ''
        ]);

        // Send email notification
        const body = `
New quote request from the website:

Name: ${data.firstName || ''} ${data.lastName || ''}
Email: ${data.email || ''}
Phone: ${data.phone || 'Not provided'}
Service: ${data.service || 'Not specified'}

Message:
${data.message || 'No message provided'}

---
This was submitted via the Lucky Landscapes website contact form.
    `.trim();

        MailApp.sendEmail({
            to: EMAIL_TO,
            subject: EMAIL_SUBJECT,
            body: body
        });

        return ContentService
            .createTextOutput(JSON.stringify({ success: true, message: 'Form submitted successfully' }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService
            .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// Handle CORS preflight
function doGet(e) {
    return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
}
