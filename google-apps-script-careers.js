/**
 * ============================================================
 * LUCKY LANDSCAPES — Career Application Google Apps Script
 * ============================================================
 *
 * HOW TO SET UP:
 * 1. Go to https://sheets.google.com and create a new spreadsheet
 * 2. Name it "Lucky Landscapes — Career Applications"
 * 3. Add headers in Row 1: Timestamp | Full Name | Email | Phone | Position | Experience | Why Join | Availability | Resume Link
 * 4. Go to Extensions → Apps Script
 * 5. Delete the default code and paste this entire file
 * 6. Update the EMAIL_TO and DRIVE_FOLDER_ID variables below
 * 7. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Copy the deployment URL
 * 9. Paste it into main.js as the CAREERS_SCRIPT_URL value
 *
 * TO GET DRIVE_FOLDER_ID:
 * 1. Go to Google Drive
 * 2. Create a folder called "Lucky Landscapes Resumes"
 * 3. Open the folder
 * 4. Copy the ID from the URL: drive.google.com/drive/folders/THIS_IS_THE_ID
 * ============================================================
 *
 * AUTHORIZATION REMINDER:
 * For email to work, you must authorize the script:
 * 1. In the Apps Script editor, select doPost from the function dropdown
 * 2. Click ▶ Run — this triggers the authorization prompt
 * 3. Accept ALL permissions (send email, access sheets, access Drive)
 * 4. Re-deploy as a NEW VERSION after authorizing
 * ============================================================
 */

// ---- CONFIG ----
const EMAIL_TO = 'rileykopf@luckylandscapes.com';
const EMAIL_SUBJECT = '🍀 New Job Application — Lucky Landscapes';
const DRIVE_FOLDER_ID = '1vR9iTKEONwC5i6D4ugnTlIB_yMYTEx6u'; // Replace this!

// ---- HANDLERS ----

function doPost(e) {
    try {
        // The website sends data as application/x-www-form-urlencoded
        // which arrives in e.parameter
        let data = {};
        let resumeBlob = null;

        if (e.parameter && (e.parameter.fullName || e.parameter.email)) {
            // Form-encoded submission (URLSearchParams from frontend)
            data = e.parameter;

            // Handle resume file (sent as base64 in form params)
            if (data.resumeData && data.resumeName) {
                const decoded = Utilities.base64Decode(data.resumeData);
                resumeBlob = Utilities.newBlob(decoded, data.resumeType || 'application/pdf', data.resumeName);
            }
        } else if (e.postData && e.postData.contents) {
            // Fallback: JSON submission
            const parsed = JSON.parse(e.postData.contents);
            Object.assign(data, parsed);

            if (parsed.resumeData && parsed.resumeName) {
                const decoded = Utilities.base64Decode(parsed.resumeData);
                resumeBlob = Utilities.newBlob(decoded, parsed.resumeType || 'application/pdf', parsed.resumeName);
            }
        }

        // Save resume to Google Drive
        let resumeLink = 'No resume uploaded';
        if (resumeBlob) {
            const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
            const file = folder.createFile(resumeBlob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            resumeLink = file.getUrl();
        }

        // Append row to sheet
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        sheet.appendRow([
            new Date().toLocaleString(),
            data.fullName || '',
            data.email || '',
            data.phone || '',
            data.position || '',
            data.experience || '',
            data.whyJoin || '',
            data.availability || '',
            resumeLink
        ]);

        // Send email notification
        const emailOptions = {
            to: EMAIL_TO,
            subject: `${EMAIL_SUBJECT} — ${data.fullName || 'Unknown'}`,
            body: `
New job application from the website:

Name: ${data.fullName || ''}
Email: ${data.email || ''}
Phone: ${data.phone || 'Not provided'}
Position: ${data.position || 'Not specified'}
Experience: ${data.experience || 'Not specified'}
Availability: ${data.availability || 'Not specified'}

Why they want to join:
${data.whyJoin || 'No answer provided'}

Resume: ${resumeLink}

---
This was submitted via the Lucky Landscapes careers page.
      `.trim()
        };

        if (resumeBlob) {
            emailOptions.attachments = [resumeBlob];
        }

        MailApp.sendEmail(emailOptions);

        return ContentService
            .createTextOutput(JSON.stringify({ success: true, message: 'Application submitted successfully' }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService
            .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
}
