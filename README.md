# Weekly Feedback Form - Project Documentation

## Project Overview

A weekly team feedback collection system built for **Kuba** (a fintech company). The system collects structured weekly updates from team members and generates AI-powered summary reports for managers.

**Live URL**: https://veryaaron.github.io/weekly/

### What It Does

1. **Collects Feedback**: Team members sign in with Google OAuth and answer questions about their week
2. **AI Follow-up**: After 3 questions, Claude generates a personalized follow-up question
3. **Stores Data**: Responses saved to Google Sheets
4. **Generates Reports**: Admins can generate AI-analyzed weekly summary reports as Google Docs

---

## Architecture

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

## File Structure

### Frontend Files (GitHub Pages)

| File | Purpose | Key Details |
|------|---------|-------------|
| `index.html` | Main UI structure | 4-step form with AI-generated Q4 |
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

## Branding

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

## Authentication

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

## Data Flow

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

## Form Fields

The form collects 4 responses:

| Question | Field ID | Description |
|----------|----------|-------------|
| Q1 | `accomplishments` | Key wins and completed work |
| Q2 | `blockers` | Challenges and support needed |
| Q3 | `priorities` | Current priorities and focus areas |
| Q4 | `aiFollowUp` | Answer to AI-generated follow-up question |

---

## Configuration Reference

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

## Google Apps Script Reference

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

---

## Deployment Checklist

### Frontend (GitHub Pages)

1. Commit updated files to repository
2. GitHub Pages auto-deploys from main branch
3. **Cache busting**: Update version strings in `index.html`:
   ```html
   <link rel="stylesheet" href="styles.css?v=1.9">
   <script src="config.js?v=1.9"></script>
   <script src="questions.js?v=1.9"></script>
   <script src="app.js?v=1.9"></script>
   ```

### Backend (Google Apps Script)

1. Open script at: https://script.google.com/
2. Make code changes
3. Save (Ctrl+S / ⌘S)
4. Deploy → Manage deployments → Edit → **New version** → Deploy

---

## Testing

### Test Apps Script Locally

In Apps Script editor, use these test functions:

| Function | Purpose |
|----------|---------|
| `testConfiguration()` | Verify all Script Properties are set |
| `testGenerateQuestion()` | Test AI question generation |
| `testGenerateReportAction()` | Test report generation via doPost |
| `testAIAnalysis()` | Test AI analysis with sample data |

### Test Frontend

1. Open browser DevTools (Safari: ⌥⌘I)
2. Check Console for errors
3. Check Network tab for API responses
4. Debug logging is included in current app.js

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.9 | 2026-01-29 | **FedCM compliance**: Removed deprecated prompt notification methods (`isNotDisplayed()`, `isSkippedMoment()`, `isDismissedMoment()`). Fixed avatar 404 error. Simplified OAuth config. |
| v1.8 | 2026-01-29 | **Major fix**: Aligned field names between HTML and JS (accomplishments, blockers, priorities, aiFollowUp). Fixed button onclick parameters. Cleaned up unused AI suggestion buttons. |
| v1.7 | 2026-01-29 | Fixed: hint selector, FEEDBACK_CONFIG references, debug logging |
| v1.6 | 2026-01-29 | Added FedCM authentication for mobile caching fix |
| v1.5 | 2026-01-23 | Added admin panel, session persistence, report generation |

---

## Development Notes

### Important Lessons Learned

1. **Field IDs must match across files** - HTML element IDs must match the field names expected by JavaScript (accomplishments, blockers, priorities, aiFollowUp)

2. **Variable scope matters** - `const CONFIG = {...}` in config.js is NOT globally accessible. Only `window.FEEDBACK_CONFIG` is available in other files.

3. **Button onclick handlers need parameters** - `nextQuestion(1)` not `nextQuestion()`

4. **Apps Script deployment ≠ saving** - Must create a "New version" deployment for changes to take effect on the web app URL

5. **Test with real data** - The "no responses" case wasn't obvious until we had no Week 5 data

6. **FedCM Migration** - Google Identity Services is transitioning to FedCM. The prompt notification methods (`isNotDisplayed()`, `isSkippedMoment()`, `isDismissedMoment()`) are deprecated. Just call `google.accounts.id.prompt()` without a callback.

7. **Avoid 404 errors** - Don't set `img.src` to empty string or undefined; check if value exists first

### Code Style Conventions

- Use `FEEDBACK_CONFIG.xxx` to access config (not `CONFIG.xxx`)
- Use `QUESTIONS.DEFINITIONS[field]` to get question config
- All functions called from HTML onclick must be on `window` object
- Field order: accomplishments → blockers → priorities → aiFollowUp

---

## Files Ready for Deployment

The following files have been updated and are ready to upload to GitHub:

1. **index.html** - Fixed field IDs, button onclick handlers, removed unused elements
2. **app.js** - Fixed textarea references, aiAnswer collection, hint updates
3. **styles.css** - Added navigation button styles, spinner animation
4. **questions.js** - No changes needed (already correct)
5. **config.js** - No changes needed
6. **google-apps-script.js** - Deploy to Google Apps Script (not GitHub)
7. **README.md** - Updated documentation

---

## Key Contacts

- **Project Owner**: Aaron (aaron@kubapay.com)
- **Hosted On**: GitHub Pages (veryaaron/weekly repository)
- **Backend**: Google Apps Script linked to Kuba Google Workspace

---

## Related Resources

- **Google Cloud Console**: OAuth credentials management
- **Google Apps Script**: https://script.google.com/
- **Google Sheets**: Stores feedback responses
- **Google Drive**: Weekly report folder (ID: `19kPZPciOyTDDyY2kl7aqHwYSvL4k6xcJ`)
- **Anthropic Console**: Claude API key management
