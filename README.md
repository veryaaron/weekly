# Weekly Feedback Form

A weekly team feedback collection system built for Kuba, featuring Google OAuth authentication, AI-powered follow-up questions, and automated report generation.

## 🎯 Purpose

This application collects structured weekly updates from team members, including:
- Wins/accomplishments
- Challenges/blockers
- Priorities for next week
- Support needed
- Ideas/suggestions

The system generates AI-powered weekly reports summarizing team feedback for managers.

## 🏗️ Architecture

### Frontend (GitHub Pages)
- **index.html** - Main UI with multi-step form
- **app.js** - Application logic, authentication, form handling
- **questions.js** - Question definitions and AI question generation
- **config.js** - Configuration (API keys, allowed domains, admin emails)
- **styles.css** - Kuba brand styling with dark mode support

### Backend (Google Apps Script)
- Receives form submissions via POST
- Stores responses in Google Sheets
- Generates weekly reports as Google Docs
- Calls Claude API for AI-generated follow-up questions

## 📁 File Structure

```
weekly/
├── index.html          # Main HTML - form structure and UI
├── app.js              # Core application logic
├── questions.js        # Question definitions + AI generation
├── config.js           # Configuration settings
├── styles.css          # Kuba brand styling
└── README.md           # This file
```

## 🔧 Configuration (config.js)

| Setting | Description |
|---------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `ALLOWED_DOMAINS` | Array of allowed email domains, or `'ANY_WORKSPACE'` |
| `ADMIN_EMAILS` | Array of emails that can generate reports |
| `GOOGLE_SCRIPT_URL` | URL of deployed Google Apps Script |
| `ANTHROPIC_API_KEY` | (Optional) Claude API key for AI features |

## 🔐 Authentication

Uses Google Identity Services (GIS) with FedCM for modern authentication:
- `use_fedcm_for_prompt: true` - Uses browser's credential management
- `auto_select: false` - Prevents automatic sign-in issues on mobile
- `ux_mode: 'popup'` - Better mobile handling
- Session persists for 1 hour via `sessionStorage`

### FedCM (v1.6+)
Federated Credential Management moves credential caching to the browser level, eliminating conflicts with Google's own caching that caused blank pages on mobile.

## 📊 Admin Features

Admins (defined in `CONFIG.ADMIN_EMAILS`) see a "Manager Tools" panel:
- Generate weekly reports on demand
- Reports are created as Google Docs
- Links directly to generated reports

## 🎨 Branding

Uses Kuba brand guidelines:
- **Colors**: Navy `#272251`, Yellow `#ffd618`, Coral `#e9426d`, Green `#00a870`
- **Typography**: Ubuntu (primary), Calibri (fallback)
- **Design element**: "Kuba kurve" (yellow triangle accent)
- **Dark mode**: Automatic based on system preference

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.7 | 2025-01-29 | Fixed hint selector (`.question-hint` → `.hint`), centered sign-in button |
| v1.6 | 2025-01-29 | Added FedCM authentication for mobile caching fix |
| v1.5 | 2025-01-23 | Added admin panel, session persistence, report generation |

## ⚠️ Known Issues / Notes

### Field Name Mismatch
The HTML form uses field IDs: `wins`, `challenges`, `priorities`, `support`, `ideas`
The JavaScript expects: `accomplishments`, `blockers`, `priorities`, `aiFollowUp`

This may need reconciliation depending on intended behavior.

### Apps Script Response Format
The Google Apps Script should return:
```json
{
  "status": "success",
  "docUrl": "https://docs.google.com/document/d/..."
}
```

## 🚀 Deployment

### Frontend (GitHub Pages)
1. Push files to GitHub repository
2. Enable GitHub Pages in repository settings
3. Site deploys to `https://<username>.github.io/<repo>/`

### Backend (Google Apps Script)
1. Create new Google Apps Script project
2. Paste script code
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Copy deployment URL to `config.js`

### Cache Busting
Update version query strings in `index.html` when deploying changes:
```html
<link rel="stylesheet" href="styles.css?v=1.7">
<script src="config.js?v=1.7"></script>
<script src="questions.js?v=1.7"></script>
<script src="app.js?v=1.7"></script>
```

## 🔌 API Reference

### questions.js API

```javascript
QUESTIONS.DEFINITIONS[field]     // Get question config object
QUESTIONS.getOrder()             // Returns ['accomplishments', 'blockers', 'priorities', 'aiFollowUp']
QUESTIONS.getFieldByIndex(i)     // Get field name by 1-based index
QUESTIONS.getByIndex(i)          // Get question config by 1-based index
QUESTIONS.TOTAL                  // Total question count (4)

// Question config object
{
  id: 'fieldName',
  questionNumber: 1,
  required: true,
  label: 'Display Label',
  showAIButton: false,
  generateHint: function(userData, cachedAnswers) { ... }
}
```

### app.js Global Functions

```javascript
window.handleCredentialResponse  // Google OAuth callback
window.signOut                   // Sign out user
window.nextQuestion              // Navigate to next question
window.prevQuestion              // Navigate to previous question
window.generateReport            // Generate admin report
window.getAnswerCache()          // Get cached answers object
window.getCachedAnswer(field)    // Get cached answer for field
```

## 📝 For Developers / LLMs

When modifying this codebase:

1. **Always review existing code first** - Check current implementation before making changes
2. **Make minimal changes** - Target specific functions, not full file rewrites
3. **Check API compatibility** - Ensure `questions.js` API matches `app.js` usage
4. **Test on mobile** - Authentication issues often surface on mobile first
5. **Bump versions** - Update `?v=X.X` in `index.html` after changes
6. **Update this README** - Document changes in version history

### Key Files to Check
- `questions.js` - QUESTIONS.DEFINITIONS structure
- `app.js` - How it accesses QUESTIONS
- `index.html` - Form field IDs must match JavaScript expectations
- Google Apps Script - Response property names (e.g., `reportUrl`)

## 📞 Support

For Kuba team members: Contact Aaron for access issues or feature requests.
