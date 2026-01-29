# Weekly Feedback Form - Project Documentation

## 🎯 Project Overview

A weekly team feedback collection system built for **Kuba** (a fintech company). The system collects structured weekly updates from team members and generates AI-powered summary reports for managers.

**Live URL**: https://veryaaron.github.io/weekly/

### What It Does

1. **Collects Feedback**: Team members sign in with Google OAuth and answer questions about their week
2. **AI Follow-up**: After 3 questions, Claude generates a personalized follow-up question
3. **Stores Data**: Responses saved to Google Sheets
4. **Generates Reports**: Admins can generate AI-analyzed weekly summary reports as Google Docs

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (GitHub Pages)                      │
│         https://veryaaron.github.io/weekly/                      │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │index.html│  │ app.js   │  │questions │  │config.js │        │
│  │   (UI)   │  │ (logic)  │  │   .js    │  │(settings)│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS POST requests
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND (Google Apps Script)                     │
│                                                                  │
│  Deployed as Web App - handles 3 actions:                       │
│                                                                  │
│  1. action: 'generate'      → AI question generation            │
│  2. action: 'submit'        → Save feedback to Google Sheets    │
│  3. action: 'generateReport'→ Create weekly report Google Doc   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
│                                                                  │
│  • Google Sheets    - Stores all feedback responses              │
│  • Google Docs      - Generated weekly reports                   │
│  • Google Drive     - Report storage folder                      │
│  • Anthropic API    - Claude for AI questions & report analysis │
│  • Google OAuth     - User authentication                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

### Frontend Files (GitHub Pages)

| File | Purpose | Key Details |
|------|---------|-------------|
| `index.html` | Main UI structure | Multi-step form, 5 questions, admin panel |
| `app.js` | Application logic | OAuth, form navigation, API calls, report generation |
| `questions.js` | Question definitions | Dynamic hints with `generateHint()` functions |
| `config.js` | Configuration | OAuth client ID, allowed domains, admin emails, API URLs |
| `styles.css` | Styling | Kuba brand colors, dark mode support |

### Backend (Google Apps Script)

Single script file deployed as a web app. Contains:
- `doPost()` - Main request router
- `handleGenerateQuestion()` - Calls Claude API for follow-up questions
- `handleSubmitFeedback()` - Saves responses to Google Sheets
- `handleGenerateReport()` - Creates weekly report Google Docs
- Various helper functions for AI analysis, doc formatting, etc.

---

## 🎨 Branding

Uses **Kuba brand guidelines**:

| Element | Value |
|---------|-------|
| Primary Color (Navy) | `#272251` |
| Accent Color (Yellow) | `#ffd618` |
| Coral | `#e9426d` |
| Green | `#00a870` |
| Typography | Ubuntu (primary), Calibri (fallback) |
| Design Element | "Kuba kurve" - yellow triangle accent on cards |

Dark mode is automatic based on system preference.

---

## 🔐 Authentication

Uses **Google Identity Services (GIS)** with **FedCM** (Federated Credential Management).

### Key OAuth Settings (in app.js `initializeGoogleSignIn`)
```javascript
google.accounts.id.initialize({
    client_id: clientId,
    callback: handleCredentialResponse,
    auto_select: false,           // Prevents mobile caching issues
    use_fedcm_for_prompt: true,   // Modern credential management
    context: 'signin',
    ux_mode: 'popup'
});
```

### Why FedCM?
Mobile users were experiencing blank pages at `accounts.google.com/gsi/transform` due to conflicts between Google's library cache and browser cache. FedCM moves credential caching to browser level, eliminating this conflict.

### Domain Restrictions
- Configured in `config.js` → `ALLOWED_DOMAINS`
- Currently allows: `kubapay.com`, `vixtechnology.com`
- Can be set to `'ANY_WORKSPACE'` to allow any Google Workspace domain

### Admin Users
- Configured in `config.js` → `ADMIN_EMAILS`
- Currently: `aaron@kubapay.com`
- Admins see "Manager Tools" panel to generate reports

---

## 📊 Data Flow

### User Submits Feedback

1. User signs in via Google OAuth
2. User answers questions (accomplishments, blockers, priorities)
3. After Q3, app calls Apps Script with `action: 'generate'`
4. Apps Script calls Claude API → returns summary + follow-up question
5. User answers AI-generated Q4
6. User clicks Submit → app calls Apps Script with `action: 'submit'`
7. Apps Script saves row to Google Sheets

### Admin Generates Report

1. Admin signs in (must be in `ADMIN_EMAILS`)
2. Admin clicks "Generate Weekly Report"
3. App calls Apps Script with `action: 'generateReport'`
4. Apps Script:
   - Fetches current week's responses from Sheets
   - Calls Claude API for analysis (attention items, wins, themes)
   - Creates formatted Google Doc
   - Returns `{ status: 'success', docUrl: '...' }`
5. App displays link to report

---

## ⚠️ KNOWN ISSUES & CURRENT STATE

### Issue 1: Field Name Mismatch (STRUCTURAL)

There's a mismatch between HTML and JavaScript:

| index.html field IDs | questions.js expects |
|---------------------|---------------------|
| `wins` | `accomplishments` |
| `challenges` | `blockers` |
| `priorities` | `priorities` ✓ |
| `support` | `aiFollowUp` |
| `ideas` | (not used) |

**Impact**: The form fields in HTML don't match what the JavaScript expects from `QUESTIONS.getOrder()`. This may cause issues with form initialization and data collection.

**Resolution Needed**: Either update `index.html` field IDs to match `questions.js`, OR update `questions.js` to match the HTML.

### Issue 2: Pending Fixes in app.js (READY TO DEPLOY)

The following fixes have been made in the updated `app.js` but need to be uploaded to GitHub:

| Line | Issue | Fix |
|------|-------|-----|
| 400 | CSS selector `.question-hint` doesn't match HTML class `.hint` | Changed to `.hint` |
| 698 | `CONFIG.ADMIN_EMAILS` - CONFIG not in global scope | Changed to `FEEDBACK_CONFIG.ADMIN_EMAILS` |
| 727 | `CONFIG.GOOGLE_SCRIPT_URL` - CONFIG not in global scope | Changed to `FEEDBACK_CONFIG.GOOGLE_SCRIPT_URL` |

### Issue 3: Google Apps Script Deployment

The Apps Script must be deployed as a **new version** for changes to take effect. Simply saving the code is not enough.

**To deploy a new version:**
1. Open Apps Script editor
2. Click Deploy → Manage deployments
3. Click pencil icon ✏️ to edit
4. Change Version dropdown to "New version"
5. Click Deploy

---

## 🔧 Configuration Reference

### config.js Settings

```javascript
const CONFIG = {
    // Google OAuth - from Google Cloud Console
    GOOGLE_CLIENT_ID: '287284865613-xxx.apps.googleusercontent.com',
    
    // Allowed email domains (or 'ANY_WORKSPACE')
    ALLOWED_DOMAINS: ['kubapay.com', 'vixtechnology.com'],
    
    // Users who see admin panel
    ADMIN_EMAILS: ['aaron@kubapay.com'],
    
    // Google Apps Script deployment URL
    GOOGLE_SCRIPT_URL: 'https://script.google.com/a/macros/kubapay.com/s/xxx/exec',
    
    // Optional - for AI features
    ANTHROPIC_API_KEY: '',  // Usually stored in Apps Script instead
    
    // Claude model settings
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
    CLAUDE_MAX_TOKENS: 1000,
    
    // Form behavior
    FORM_SETTINGS: {
        AUTO_LOGOUT_DELAY: 5000  // 5 seconds after submit
    }
};

// Exposed globally as:
window.FEEDBACK_CONFIG = CONFIG;
```

### Google Apps Script Properties

Set in Apps Script → Project Settings → Script Properties:

| Property | Value | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Claude API access |
| `REPORT_RECIPIENT` | `aaron@kubapay.com` | Email for scheduled reports |
| `TEAM_SIZE` | `8` | Shows "X of Y responded" in reports |
| `REPORT_FOLDER_ID` | `19kPZPciOyT...` | Google Drive folder for reports |

---

## 📝 Google Apps Script - Full Reference

The Google Apps Script is NOT stored in this repository. It lives in Google's infrastructure and is accessed via the deployment URL in config.js.

### Script Location
- Linked to Kuba Google Workspace
- Access via: https://script.google.com/

### Main Entry Point: `doPost(e)`

Routes requests based on `action` parameter:

```javascript
function doPost(e) {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'submit';
    
    if (action === 'generate') {
        return handleGenerateQuestion(data);
    } else if (action === 'submit') {
        return handleSubmitFeedback(data);
    } else if (action === 'generateReport') {
        return handleGenerateReport(data);
    }
}
```

### Action: `generate`

**Purpose**: Generate AI follow-up question based on user's first 3 answers

**Input:**
```json
{
    "action": "generate",
    "firstName": "Aaron",
    "accomplishments": "...",
    "blockers": "...",
    "priorities": "..."
}
```

**Output:**
```json
{
    "status": "success",
    "summary": "2-3 sentence summary",
    "question": "Personalized follow-up question"
}
```

### Action: `submit`

**Purpose**: Save completed feedback form to Google Sheets

**Input:**
```json
{
    "action": "submit",
    "timestamp": "2026-01-29T14:00:00.000Z",
    "name": "Aaron Smith",
    "email": "aaron@kubapay.com",
    "accomplishments": "...",
    "blockers": "...",
    "priorities": "...",
    "aiSummary": "...",
    "aiQuestion": "...",
    "aiAnswer": "..."
}
```

**Output:**
```json
{
    "status": "success",
    "message": "Feedback recorded successfully"
}
```

### Action: `generateReport`

**Purpose**: Create weekly summary report as Google Doc

**Input:**
```json
{
    "action": "generateReport",
    "requestedBy": "aaron@kubapay.com"
}
```

**Output (success):**
```json
{
    "status": "success",
    "docUrl": "https://docs.google.com/document/d/xxx/edit",
    "responseCount": 5,
    "week": 5,
    "year": 2026
}
```

**Output (no data):**
```json
{
    "status": "no_responses",
    "message": "No responses found for this week"
}
```

### Google Sheets Structure

The Apps Script expects/creates these columns:

| Column | Content |
|--------|---------|
| A | Timestamp |
| B | Name |
| C | Email |
| D | Q1: Accomplishments |
| E | Q2: Blockers |
| F | Q3: Priorities |
| G | AI Summary |
| H | AI Question |
| I | Answer to AI Question |
| J | Week Number |
| K | Year |

### Complete Google Apps Script Code

For reference, here is the full script that should be deployed:

```javascript
/**
 * GOOGLE APPS SCRIPT - WEEKLY FEEDBACK HANDLER + REPORT GENERATOR
 * 
 * Handles:
 * 1. AI question generation (POST with action: 'generate')
 * 2. Form submission (POST with action: 'submit')
 * 3. Weekly report generation (POST with action: 'generateReport')
 */

// ========================================
// CONFIGURATION
// ========================================

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    apiKey: props.getProperty('ANTHROPIC_API_KEY'),
    reportRecipient: props.getProperty('REPORT_RECIPIENT') || Session.getActiveUser().getEmail(),
    teamSize: parseInt(props.getProperty('TEAM_SIZE')) || 8,
    reportFolderId: props.getProperty('REPORT_FOLDER_ID') || null
  };
}

function getAnthropicApiKey() {
  return getConfig().apiKey;
}

// ========================================
// MAIN REQUEST HANDLER
// ========================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'submit';
    
    Logger.log('Received action: ' + action);
    
    let result;
    if (action === 'generate') {
      result = handleGenerateQuestion(data);
    } else if (action === 'submit') {
      result = handleSubmitFeedback(data);
    } else if (action === 'generateReport') {
      result = handleGenerateReport(data);
    } else {
      throw new Error('Unknown action: ' + action);
    }
    
    return result;
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'ok',
    'message': 'Weekly Feedback API is running'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// WEB-TRIGGERED REPORT GENERATION
// ========================================

function handleGenerateReport(data) {
  const config = getConfig();
  const requestedBy = data.requestedBy || 'unknown';
  
  Logger.log('Report requested by: ' + requestedBy);
  
  const now = new Date();
  const currentWeek = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const currentYear = now.getFullYear();
  
  const responses = getResponsesForWeek(currentWeek, currentYear);
  
  if (responses.length === 0) {
    Logger.log('No responses found for week ' + currentWeek);
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'no_responses',
      'message': 'No responses found for this week'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  Logger.log('Found ' + responses.length + ' responses for week ' + currentWeek);
  
  const aiAnalysis = generateAIAnalysis(responses, config);
  const docUrl = createReportDocForWeek(responses, aiAnalysis, config, currentWeek, currentYear);
  
  Logger.log('Report generated: ' + docUrl);
  
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'docUrl': docUrl,
    'responseCount': responses.length,
    'week': currentWeek,
    'year': currentYear
  })).setMimeType(ContentService.MimeType.JSON);
}

// ... (additional functions for AI generation, form submission, etc.)
// See google-apps-script.js for complete code
```

---

## 🚀 Deployment Checklist

### Frontend (GitHub Pages)

1. Commit updated files to repository
2. GitHub Pages auto-deploys from main branch
3. **Cache busting**: Update version strings in `index.html`:
   ```html
   <link rel="stylesheet" href="styles.css?v=1.7">
   <script src="config.js?v=1.7"></script>
   <script src="questions.js?v=1.7"></script>
   <script src="app.js?v=1.7"></script>
   ```

### Backend (Google Apps Script)

1. Open script at: https://script.google.com/
2. Make code changes
3. Save (Ctrl+S / ⌘S)
4. Deploy → Manage deployments → Edit → **New version** → Deploy

---

## 🧪 Testing

### Test Apps Script Locally

In Apps Script editor, use these test functions:

| Function | Purpose |
|----------|---------|
| `testConfiguration()` | Verify all Script Properties are set |
| `testGenerateQuestion()` | Test AI question generation |
| `testGenerateReportAction()` | Test report generation via doPost |
| `testAIAnalysis()` | Test AI analysis with sample data |

Add this test function to verify report generation:
```javascript
function testGenerateReportAction() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'generateReport',
        requestedBy: 'aaron@kubapay.com'
      })
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log('Response: ' + result.getContent());
}
```

### Test Frontend

1. Open browser DevTools (Safari: ⌥⌘I)
2. Check Console for errors
3. Check Network tab for API responses
4. Debug logging is included in current app.js

---

## 📅 Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.7 | 2026-01-29 | Fixed: hint selector, FEEDBACK_CONFIG references, debug logging |
| v1.6 | 2026-01-29 | Added FedCM authentication for mobile caching fix |
| v1.5 | 2026-01-23 | Added admin panel, session persistence, report generation |

---

## 🔜 Next Steps / TODO

1. **Deploy updated app.js** with the 3 fixes (selector, config references)
2. **Resolve field name mismatch** between index.html and questions.js
3. **Test full flow** with actual feedback submission
4. **Verify report generation** works when there are responses
5. Consider adding error handling UI for edge cases

---

## 📞 Key Contacts

- **Project Owner**: Aaron (aaron@kubapay.com)
- **Hosted On**: GitHub Pages (veryaaron/weekly repository)
- **Backend**: Google Apps Script linked to Kuba Google Workspace

---

## 🗂️ Related Resources

- **Google Cloud Console**: OAuth credentials management
- **Google Apps Script**: https://script.google.com/
- **Google Sheets**: Stores feedback responses
- **Google Drive**: Weekly report folder (ID: `19kPZPciOyTDDyY2kl7aqHwYSvL4k6xcJ`)
- **Anthropic Console**: Claude API key management

---

## 💡 Development Notes

### Important Lessons Learned

1. **Always review existing code before making changes** - Don't rewrite functions without checking how they currently work

2. **Variable scope matters** - `const CONFIG = {...}` in config.js is NOT globally accessible. Only `window.FEEDBACK_CONFIG` is available in other files.

3. **CSS selectors must match HTML** - The app.js was looking for `.question-hint` but HTML uses `.hint`

4. **Apps Script deployment ≠ saving** - Must create a "New version" deployment for changes to take effect on the web app URL

5. **Test with real data** - The "no responses" case wasn't obvious until we had no Week 5 data

### Code Style Conventions

- Use `FEEDBACK_CONFIG.xxx` to access config (not `CONFIG.xxx`)
- Use `QUESTIONS.DEFINITIONS[field]` to get question config (not `QUESTIONS.get()`)
- All functions called from HTML onclick must be on `window` object

---

## 📋 Files Ready for Deployment

The following files have been prepared with fixes and are ready to upload to GitHub:

1. **app.js** - Contains all 3 bug fixes + debug logging
2. **google-apps-script.js** - Complete backend script (deploy to Google Apps Script, not GitHub)
3. **README.md** - This documentation file

Upload app.js to GitHub and update the version string in index.html from `?v=1.6` to `?v=1.7` to bust browser cache.
