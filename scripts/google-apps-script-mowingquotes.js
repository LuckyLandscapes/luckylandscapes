/**
 * ============================================================
 * LUCKY LANDSCAPES — Lawn Mowing Quotes Google Apps Script
 * ============================================================
 *
 * HOW TO SET UP:
 * 1. Go to https://sheets.google.com and create a new spreadsheet
 * 2. Name it "Lucky Landscapes — Mowing Quotes"
 * 3. Add headers in Row 1:
 *    Timestamp | Name | Email | Phone | Address | Lawn SqFt | Condition | Service Type | Mow Count | Extras | Per-Visit Price | Total Price | Decision
 * 4. Go to Extensions → Apps Script
 * 5. Delete the default code and paste this entire file
 * 6. Update the EMAIL_TO variable below with your email
 * 7. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy the deployment URL
 * 9. Paste it into main.js as the QUOTES_SCRIPT_URL value
 *
 * IMPORTANT: After pasting, click Deploy → Manage deployments → Edit → Update
 *            every time you make changes to this script.
 * ============================================================
 *
 * AUTHORIZATION REMINDER:
 * For email to work, you must authorize the script:
 * 1. In the Apps Script editor, select doPost from the function dropdown
 * 2. Click ▶ Run — this triggers the authorization prompt
 * 3. Accept ALL permissions (send email, access sheets)
 * 4. Re-deploy as a NEW VERSION after authorizing
 * ============================================================
 */

// ---- CONFIG ----
const EMAIL_TO = 'rileykopf@luckylandscapes.com';
const EMAIL_SUBJECT = '🍀 New Mowing Quote — Lucky Landscapes';

// ---- HANDLERS ----

function doPost(e) {
    try {
        let data = {};

        if (e.parameter && e.parameter.firstName) {
            data = e.parameter;
        } else if (e.postData && e.postData.contents) {
            data = JSON.parse(e.postData.contents);
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        const name = (data.firstName || '') + ' ' + (data.lastName || '');

        sheet.appendRow([
            new Date().toLocaleString(),
            name.trim(),
            data.email || '',
            data.phone || '',
            data.address || '',
            data.sqft || '',
            data.condition || '',
            data.serviceType || '',
            data.mowCount || '',
            data.extras || '',
            data.perVisitPrice || '',
            data.totalPrice || '',
            data.decision || 'pending'
        ]);

        // Send email notification
        const body = `
New mowing quote from the website:

Customer: ${name.trim()}
Email: ${data.email || ''}
Phone: ${data.phone || 'Not provided'}
Address: ${data.address || 'Not provided'}

Lawn Size: ${data.sqft || '?'} sq ft
Condition: ${data.condition || 'Not specified'}
Service Type: ${data.serviceType || ''}
Mow Count: ${data.mowCount || ''}
Extras: ${data.extras || 'None'}

Estimated Per-Visit: $${data.perVisitPrice || '?'}
Estimated Total: $${data.totalPrice || '?'}
Decision: ${data.decision || 'pending'}

---
This was submitted via the Lucky Landscapes mowing quote page.
    `.trim();

        MailApp.sendEmail({
            to: EMAIL_TO,
            subject: EMAIL_SUBJECT,
            body: body
        });

        return ContentService
            .createTextOutput(JSON.stringify({ success: true, message: 'Quote submitted successfully' }))
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
