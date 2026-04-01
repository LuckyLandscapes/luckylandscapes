# Google Sheets Quote Backend — Setup Instructions

## Overview
This guide walks you through deploying the quote submission backend. When complete:
- Quote submissions will be logged to a Google Sheet automatically
- You'll get an email notification for every new quote
- Customer-uploaded photos will be saved to Google Drive

## Step-by-Step Setup

### 1. Create the Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click **New Project** (top left)
3. Name the project: `Lucky Landscapes Quote Handler`
4. Delete the default `myFunction()` code
5. Copy the **entire** contents of `quote-apps-script.js` and paste it in
6. Save the project (Ctrl+S / Cmd+S)

### 2. Test the Setup

1. In the script editor, select `testSetup` from the function dropdown (top toolbar)
2. Click the **Run** ▶ button
3. You'll be asked to authorize the script — click through and allow:
   - Google Sheets access
   - Google Drive access
   - Gmail (for sending notifications)
4. Check the **Execution log** tab at the bottom — you should see:
   - "Sheet ready: (URL)"
   - "Folder ready: (URL)"
   - "Setup looks good!"

### 3. Deploy as Web App

1. Click **Deploy** → **New deployment** (top right)
2. Click the gear icon ⚙️ next to "Select type" → choose **Web app**
3. Fill in:
   - **Description**: `Quote form handler v1`
   - **Execute as**: `Me` (your email)
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

### 4. Add the URL to Your Website

1. Open `main.js` in your code editor
2. Find this line near the top:
   ```js
   const QUOTES_SCRIPT_URL = '';
   ```
3. Paste your deployed URL between the quotes:
   ```js
   const QUOTES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
   ```
4. Save and deploy your website

### 5. Test a Live Submission

1. Go to your quote page and fill out a test quote
2. Check your email for the notification
3. Open the "Quote Submissions" spreadsheet in Google Drive
4. Verify the row was added with all the data

## Updating the Script

If you need to update the script later:
1. Make your changes in the script editor
2. Click **Deploy** → **Manage deployments**
3. Click the pencil ✏️ icon on your deployment
4. Change **Version** to **New version**
5. Click **Deploy**

> **Important**: The URL stays the same — no need to update `main.js` after updating the script.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No email received | Check spam folder. Verify `NOTIFICATION_EMAIL` in the script. |
| "Script not authorized" | Re-run `testSetup` and re-authorize permissions. |
| Photos not uploading | Check that the Drive folder "Lucky Landscapes — Quote Photos" exists. |
| Submissions not logging | Go to script.google.com → Executions tab → check for errors. |

## Data Location

- **Spreadsheet**: Search Google Drive for "Quote Submissions"
- **Photos folder**: Search Google Drive for "Lucky Landscapes — Quote Photos"
- **Script**: [script.google.com](https://script.google.com) → "Lucky Landscapes Quote Handler"
