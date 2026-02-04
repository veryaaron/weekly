/**
 * GOOGLE APPS SCRIPT - WEEKLY FEEDBACK HANDLER + REPORT GENERATOR
 *
 * Handles:
 * 1. AI question generation (POST with action: 'generate')
 * 2. Form submission (POST with action: 'submit')
 * 3. Weekly report generation (POST with action: 'generateReport')
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet for storing feedback
 * 2. Open Extensions > Apps Script
 * 3. Paste this code
 * 4. Add Script Properties (see Configuration section)
 * 5. **IMPORTANT**: Set up OAuth scopes (see below)
 * 6. Deploy as Web App with "Anyone" access
 * 7. Set up weekly trigger for generateWeeklyReport()
 *
 * OAUTH SCOPES SETUP (Required for report generation):
 * 1. In Apps Script editor, click ⚙️ (Project Settings)
 * 2. Check "Show 'appsscript.json' manifest file in editor"
 * 3. Click Editor (< >) in left sidebar
 * 4. Open appsscript.json and replace with:
 *
 * {
 *   "timeZone": "Europe/London",
 *   "dependencies": {},
 *   "exceptionLogging": "STACKDRIVER",
 *   "runtimeVersion": "V8",
 *   "oauthScopes": [
 *     "https://www.googleapis.com/auth/spreadsheets",
 *     "https://www.googleapis.com/auth/documents",
 *     "https://www.googleapis.com/auth/drive",
 *     "https://www.googleapis.com/auth/script.external_request"
 *   ]
 * }
 *
 * Note: gmail.send scope is OPTIONAL - only needed if you want automatic
 * email notifications when reports are generated. The script works fine
 * without it; you'll just access reports via the link instead of email.
 *
 * 5. Save the file
 * 6. Run any function (e.g., testConfiguration) to trigger re-authorization
 * 7. Accept the new permissions when prompted
 * 8. Create a new deployment
 */

// ========================================
// CONFIGURATION
// ========================================

/**
 * SCRIPT PROPERTIES TO SET:
 * 
 * 1. In Apps Script editor, click ⚙️ (Project Settings)
 * 2. Scroll to "Script Properties"
 * 3. Add these properties:
 * 
 *    ANTHROPIC_API_KEY    = sk-ant-api03-YOUR-KEY-HERE
 *    REPORT_RECIPIENT     = aaron@kubapay.com
 *    TEAM_SIZE            = 8
 *    REPORT_FOLDER_ID     = (optional) Google Drive folder ID for reports
 */

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
  // Get API key directly without going through getConfig()
  // This avoids Session.getActiveUser() which doesn't work in web request context
  return PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
}

// ========================================
// CORS HANDLING
// ========================================

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
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
    } else if (action === 'getPreviousWeek') {
      result = handleGetPreviousWeek(data);
    } else if (action === 'getWeeklyStatus') {
      result = handleGetWeeklyStatus(data);
    } else if (action === 'sendChaseEmail') {
      result = handleSendChaseEmail(data);
    } else if (action === 'sendBulkChase') {
      result = handleSendBulkChase(data);
    } else if (action === 'sendWeeklyPrompt') {
      result = handleSendWeeklyPrompt(data);
    } else if (action === 'sendWeeklyReminder') {
      result = handleSendWeeklyReminder(data);
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

/**
 * Handle report generation request from web form
 * Called when admin clicks "Generate Report" button
 */
function handleGenerateReport(data) {
  const config = getConfig();
  const requestedBy = data.requestedBy || 'unknown';
  
  Logger.log('Report requested by: ' + requestedBy);
  
  // Get current week's responses
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
  
  // Generate AI analysis
  const aiAnalysis = generateAIAnalysis(responses, config);
  
  // Create Google Doc
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

// ========================================
// PREVIOUS WEEK RECALL
// ========================================

/**
 * Get user's previous week submission for recall feature
 * Returns their accomplishments, blockers, and priorities from last week
 */
function handleGetPreviousWeek(data) {
  const email = data.email;

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': 'Email is required'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log('Getting previous week data for: ' + email);

  // Calculate previous week number
  const now = new Date();
  const currentWeek = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const currentYear = now.getFullYear();

  // Handle year boundary (week 1 → previous year's last week)
  let previousWeek = currentWeek - 1;
  let previousYear = currentYear;
  if (previousWeek <= 0) {
    previousYear = currentYear - 1;
    // Get last week of previous year
    const lastDayPrevYear = new Date(previousYear, 11, 31);
    previousWeek = parseInt(Utilities.formatDate(lastDayPrevYear, 'Europe/London', 'w'));
  }

  Logger.log('Looking for Week ' + previousWeek + ', ' + previousYear);

  // Search for user's submission from previous week
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data_rows = sheet.getDataRange().getValues();

  if (data_rows.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'found': false,
      'message': 'No previous submissions found'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Find most recent submission for this email in previous week
  let previousSubmission = null;

  for (let i = data_rows.length - 1; i >= 1; i--) {
    const row = data_rows[i];
    const rowEmail = row[2];  // Email column
    const rowWeek = row[9];   // Week Number column
    const rowYear = row[10];  // Year column

    if (rowEmail && rowEmail.toLowerCase() === email.toLowerCase() &&
        rowWeek == previousWeek && rowYear == previousYear) {
      previousSubmission = {
        timestamp: row[0],
        name: row[1],
        accomplishments: row[3] || '',
        blockers: row[4] || '',
        priorities: row[5] || '',
        aiSummary: row[6] || '',
        shoutouts: row[11] || ''  // New shoutouts column (if exists)
      };
      break;  // Found most recent, stop searching
    }
  }

  if (previousSubmission) {
    Logger.log('Found previous submission for: ' + email);
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'found': true,
      'week': previousWeek,
      'year': previousYear,
      'data': previousSubmission
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    Logger.log('No previous submission found for: ' + email);
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'success',
      'found': false,
      'week': previousWeek,
      'year': previousYear,
      'message': 'No submission found for previous week'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================
// AI QUESTION GENERATION
// ========================================

function handleGenerateQuestion(data) {
  const apiKey = getAnthropicApiKey();
  
  if (!apiKey) {
    Logger.log('No API key configured');
    return ContentService.createTextOutput(JSON.stringify({
      'status': 'error',
      'message': 'API key not configured. Please add ANTHROPIC_API_KEY to Script Properties.'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const firstName = data.firstName || 'Team Member';
  const accomplishments = data.accomplishments || 'No answer provided';
  const blockers = data.blockers || 'No answer provided';
  const priorities = data.priorities || 'No answer provided';
  
  const prompt = `I am conducting a weekly check-in with ${firstName}. They have answered these three questions:

Question 1 - Key Accomplishments This Week:
"${accomplishments}"

Question 2 - Blockers & Challenges (what is currently blocking your path, what support or resources do you need):
"${blockers}"

Question 3 - Priorities (current priorities and if they're happy this is the right priority list for the business):
"${priorities}"

Please:
1. Summarize the answers given to these three questions in 2-3 sentences
2. Ask ONE question that you think is pertinent to the answers given

Format your response exactly as:
SUMMARY: [your 2-3 sentence summary]
QUESTION: [your single pertinent question]`;

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('API Response Code: ' + responseCode);
    
    if (responseCode !== 200) {
      throw new Error('API returned ' + responseCode + ': ' + responseText);
    }
    
    const apiData = JSON.parse(responseText);
    const aiResponse = apiData.content[0].text.trim();
    
    const summaryMatch = aiResponse.match(/SUMMARY:\s*(.+?)(?=QUESTION:|$)/s);
    const questionMatch = aiResponse.match(/QUESTION:\s*(.+?)$/s);
    
    const result = {
      status: 'success',
      summary: summaryMatch ? summaryMatch[1].trim() : '',
      question: questionMatch ? questionMatch[1].trim() : 'What else would you like to share about this week?'
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('AI Generation Error: ' + error.toString());
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      summary: 'Thank you for sharing your updates.',
      question: 'Is there anything else important you\'d like to discuss this week?'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================
// FORM SUBMISSION
// ========================================

function handleSubmitFeedback(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // v2.2: Updated schema with previousWeekProgress and shoutouts columns
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp',
      'Name',
      'Email',
      'Q1: Accomplishments',
      'Q2: Previous Week Progress',  // NEW: Progress on last week's priorities
      'Q3: Blockers',
      'Q4: Priorities',
      'Q5: Shoutouts',               // NEW: Recognition/shoutouts
      'AI Summary',
      'AI Question',
      'Answer to AI Question',
      'Week Number',
      'Year'
    ]);

    const headerRange = sheet.getRange(1, 1, 1, 13);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#272251');
    headerRange.setFontColor('#FFFFFF');
  }

  const timestamp = new Date(data.timestamp);
  const weekNumber = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'w');
  const year = timestamp.getFullYear();

  sheet.appendRow([
    timestamp,
    data.name,
    data.email || '',
    data.accomplishments || '',
    data.previousWeekProgress || '',  // NEW
    data.blockers || '',
    data.priorities || '',
    data.shoutouts || '',             // NEW
    data.aiSummary || '',
    data.aiQuestion || '',
    data.aiAnswer || '',
    weekNumber,
    year
  ]);

  sheet.autoResizeColumns(1, 13);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  sheet.getRange(lastRow, 4, 1, 8).setWrap(true);
  
  Logger.log('Feedback saved for: ' + data.name);
  
  return ContentService.createTextOutput(JSON.stringify({
    'status': 'success',
    'message': 'Feedback recorded successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// WEEKLY REPORT GENERATION
// ========================================

/**
 * Main function to generate weekly report for CURRENT week
 * Can be run manually or via time-based trigger
 */
function generateWeeklyReport() {
  Logger.log('Starting weekly report generation (current week)...');
  generateWeeklyReportForWeek(null, null); // null = current week
}

/**
 * Get all responses from the current week (legacy function, now calls getResponsesForWeek)
 */
function getThisWeekResponses() {
  const now = new Date();
  const currentWeek = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const currentYear = now.getFullYear();
  return getResponsesForWeek(currentWeek, currentYear);
}

/**
 * Generate AI analysis of all responses
 */
function generateAIAnalysis(responses, config) {
  const apiKey = config.apiKey;
  
  if (!apiKey) {
    Logger.log('No API key - skipping AI analysis');
    return {
      attentionItems: [],
      wins: [],
      themes: [],
      individualSummaries: responses.map(r => ({
        name: r.name,
        summary: r.aiSummary || 'No summary available'
      }))
    };
  }
  
  // Build the prompt with all responses
  let responseText = '';
  responses.forEach((r, i) => {
    responseText += `
--- RESPONSE ${i + 1}: ${r.name} ---
Accomplishments: ${r.accomplishments}
Blockers: ${r.blockers}
Priorities: ${r.priorities}
Follow-up Answer: ${r.aiAnswer}
`;
  });
  
  const prompt = `You are analyzing weekly feedback from a team. Here are all responses:

${responseText}

Please analyze these responses and provide a structured summary in the following JSON format:

{
  "attentionItems": [
    {"who": "Name", "issue": "Brief description", "urgency": "This week|High|Medium|Low"}
  ],
  "wins": [
    "Brief win description with (Name) attribution"
  ],
  "themes": [
    "Theme description - brief explanation"
  ],
  "individualSummaries": [
    {"name": "Name", "role": "Their area/focus", "summary": "2-3 sentence summary of their week and key points"}
  ]
}

Focus on:
1. attentionItems: Things that need manager action/decision, especially blockers, approvals needed, hiring requests
2. wins: Concrete achievements, metrics, completed work
3. themes: Patterns across multiple people (e.g., "Hiring pressure - 3 people flagged recruitment delays")
4. individualSummaries: Brief but useful summary of each person

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      throw new Error('API returned ' + responseCode);
    }
    
    const apiData = JSON.parse(response.getContentText());
    let aiText = apiData.content[0].text.trim();
    
    // Clean up any markdown code blocks
    aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    return JSON.parse(aiText);
    
  } catch (error) {
    Logger.log('AI Analysis Error: ' + error.toString());
    
    // Return basic structure without AI
    return {
      attentionItems: [],
      wins: [],
      themes: ['Unable to generate AI analysis - please review responses manually'],
      individualSummaries: responses.map(r => ({
        name: r.name,
        role: '',
        summary: r.aiSummary || 'See full response in spreadsheet'
      }))
    };
  }
}

/**
 * Create a Google Doc with the formatted report (wrapper for current week)
 */
function createReportDoc(responses, analysis, config) {
  const now = new Date();
  const weekNum = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const year = now.getFullYear();
  return createReportDocForWeek(responses, analysis, config, weekNum, year);
}

/**
 * Format a table with Kuba brand colors
 */
function formatTable(table) {
  const headerRow = table.getRow(0);
  
  for (let i = 0; i < headerRow.getNumCells(); i++) {
    const cell = headerRow.getCell(i);
    cell.setBackgroundColor('#272251');
    cell.getChild(0).asParagraph().editAsText()
      .setForegroundColor('#FFFFFF')
      .setBold(true)
      .setFontSize(10);
  }
  
  for (let r = 1; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    const bgColor = r % 2 === 0 ? '#f5f5f7' : '#ffffff';
    
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setBackgroundColor(bgColor);
      cell.getChild(0).asParagraph().editAsText()
        .setFontSize(10)
        .setForegroundColor('#333333');
    }
  }
}

/**
 * Send email with report link (wrapper for current week)
 */
function sendReportEmail(docUrl, responseCount, config) {
  const now = new Date();
  const weekNum = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const year = now.getFullYear();
  sendReportEmailForWeek(docUrl, responseCount, config, weekNum, year);
}

/**
 * Send email when no responses received (optional - only used by scheduled trigger)
 */
function sendNoResponsesEmail(config) {
  const now = new Date();
  const weekNum = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const year = now.getFullYear();
  
  const subject = `📋 Team Pulse - Week ${weekNum}, ${year} - No Responses`;
  
  const htmlBody = `
    <div style="font-family: Ubuntu, Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #272251; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📋 Team Pulse</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Week ${weekNum}, ${year}</p>
      </div>
      
      <div style="background: #f5f5f7; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="color: #333; font-size: 14px; line-height: 1.6;">
          No team feedback responses were received this week. You may want to send a reminder to your team.
        </p>
      </div>
    </div>
  `;
  
  try {
    GmailApp.sendEmail(config.reportRecipient, subject, 'No team feedback responses this week.', {
      htmlBody: htmlBody,
      name: 'Weekly Feedback System'
    });
    Logger.log('No-responses email sent to: ' + config.reportRecipient);
  } catch (e) {
    // Gmail permission not granted - just log
    Logger.log('No responses this week. Email not sent (no Gmail permission).');
  }
}

// ========================================
// TRIGGER SETUP
// ========================================

/**
 * Set up weekly trigger - run this once manually
 * Generates report every Thursday at 2pm UK time
 */
function setupWeeklyTrigger() {
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'generateWeeklyReport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger for Thursday at 2pm (14:00)
  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(14)
    .inTimezone('Europe/London')
    .create();
  
  Logger.log('✅ Weekly trigger set for Thursdays at 14:00 UK time');
}

/**
 * Remove all triggers
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
    Logger.log('Removed trigger: ' + trigger.getHandlerFunction());
  });
  Logger.log('All triggers removed');
}

// ========================================
// EMAIL REMINDER SYSTEM (v2.2)
// ========================================

/**
 * Get active team members from the "Team Members" sheet
 * Sheet should have columns: Email, Name, Active, Role
 */
function getActiveTeamMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const teamSheet = ss.getSheetByName('Team Members');

  if (!teamSheet) {
    Logger.log('Team Members sheet not found - please create it');
    return [];
  }

  const data = teamSheet.getDataRange().getValues();
  const teamMembers = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = row[0];
    const name = row[1];
    const active = row[2];
    const role = row[3] || '';

    // Only include active team members (Active column should be TRUE or "Yes")
    if (email && (active === true || active === 'Yes' || active === 'TRUE' || active === 'Active')) {
      teamMembers.push({
        email: email.toLowerCase().trim(),
        name: name || email.split('@')[0],
        role: role
      });
    }
  }

  Logger.log('Found ' + teamMembers.length + ' active team members');
  return teamMembers;
}

/**
 * Get list of emails who have submitted this week
 */
function getThisWeekSubmitters() {
  const now = new Date();
  const currentWeek = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const currentYear = now.getFullYear();

  const responses = getResponsesForWeek(currentWeek, currentYear);
  const submitters = responses.map(r => r.email.toLowerCase().trim());

  Logger.log('This week submitters: ' + submitters.join(', '));
  return submitters;
}

/**
 * Send Wednesday morning reminder to team members who haven't submitted
 * Scheduled to run every Wednesday at 9 AM UK time
 */
function sendWednesdayReminder() {
  Logger.log('Running Wednesday reminder...');

  const teamMembers = getActiveTeamMembers();
  const submitters = getThisWeekSubmitters();
  const config = getConfig();

  // Find who hasn't submitted yet
  const pending = teamMembers.filter(m => !submitters.includes(m.email));

  Logger.log('Pending submissions: ' + pending.length);

  if (pending.length === 0) {
    Logger.log('Everyone has already submitted!');
    return;
  }

  const formUrl = 'https://veryaaron.github.io/weekly/';  // TODO: Update when migrated to tools.kubapay.workers.dev

  pending.forEach(member => {
    const subject = '📋 Weekly Feedback Reminder';

    const htmlBody = `
      <div style="font-family: Ubuntu, Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #272251; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">📋 Weekly Feedback</h1>
        </div>

        <div style="background: #f5f5f7; padding: 25px; border-radius: 0 0 8px 8px;">
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi ${member.name.split(' ')[0]},
          </p>

          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            It's time for your weekly feedback! Please take a few minutes to share your accomplishments, blockers, and priorities for this week.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}" style="background: #272251; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Submit Weekly Feedback →
            </a>
          </div>

          <p style="color: #666; font-size: 13px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #ddd;">
            Please submit by Thursday to be included in the weekly report.
          </p>
        </div>
      </div>
    `;

    try {
      GmailApp.sendEmail(member.email, subject, 'Please submit your weekly feedback: ' + formUrl, {
        htmlBody: htmlBody,
        name: 'Weekly Feedback System'
      });
      Logger.log('Sent reminder to: ' + member.email);
    } catch (e) {
      Logger.log('Failed to send to ' + member.email + ': ' + e.toString());
    }
  });

  Logger.log('Wednesday reminders sent to ' + pending.length + ' people');
}

/**
 * Send Thursday follow-up reminder to those who still haven't submitted
 * Scheduled to run every Thursday at 5 PM UK time
 */
function sendThursdayReminder() {
  Logger.log('Running Thursday follow-up reminder...');

  const teamMembers = getActiveTeamMembers();
  const submitters = getThisWeekSubmitters();
  const config = getConfig();

  // Find who still hasn't submitted
  const pending = teamMembers.filter(m => !submitters.includes(m.email));

  Logger.log('Still pending: ' + pending.length);

  if (pending.length === 0) {
    Logger.log('Everyone has submitted!');
    return;
  }

  const formUrl = 'https://veryaaron.github.io/weekly/';  // TODO: Update when migrated

  pending.forEach(member => {
    const subject = '⏰ Last Call: Weekly Feedback Due Today';

    const htmlBody = `
      <div style="font-family: Ubuntu, Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #e9426d; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">⏰ Reminder: Feedback Due Today</h1>
        </div>

        <div style="background: #f5f5f7; padding: 25px; border-radius: 0 0 8px 8px;">
          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi ${member.name.split(' ')[0]},
          </p>

          <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            This is a gentle reminder that we haven't received your weekly feedback yet. The weekly report will be generated soon, and we'd love to include your updates!
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${formUrl}" style="background: #272251; color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Submit Now →
            </a>
          </div>

          <p style="color: #666; font-size: 13px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #ddd;">
            Takes only 5 minutes. Your input helps keep the team connected.
          </p>
        </div>
      </div>
    `;

    try {
      GmailApp.sendEmail(member.email, subject, 'Last call for weekly feedback: ' + formUrl, {
        htmlBody: htmlBody,
        name: 'Weekly Feedback System'
      });
      Logger.log('Sent Thursday reminder to: ' + member.email);
    } catch (e) {
      Logger.log('Failed to send to ' + member.email + ': ' + e.toString());
    }
  });

  Logger.log('Thursday reminders sent to ' + pending.length + ' people');
}

/**
 * Set up email reminder triggers
 * Run this once to schedule the automatic reminders
 */
function setupEmailReminderTriggers() {
  // Remove existing reminder triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const handler = trigger.getHandlerFunction();
    if (handler === 'sendWednesdayReminder' || handler === 'sendThursdayReminder') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Removed existing trigger: ' + handler);
    }
  });

  // Wednesday 9 AM UK time - Initial reminder
  ScriptApp.newTrigger('sendWednesdayReminder')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(9)
    .inTimezone('Europe/London')
    .create();

  // Thursday 5 PM UK time - Follow-up reminder
  ScriptApp.newTrigger('sendThursdayReminder')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(17)
    .inTimezone('Europe/London')
    .create();

  Logger.log('✅ Email reminder triggers set:');
  Logger.log('   - Wednesday 9 AM UK: Initial reminder');
  Logger.log('   - Thursday 5 PM UK: Follow-up reminder');
}

/**
 * Test function: Send reminder to yourself
 */
function testSendReminderToSelf() {
  const config = getConfig();
  const testEmail = config.reportRecipient || Session.getActiveUser().getEmail();
  const formUrl = 'https://veryaaron.github.io/weekly/';

  const htmlBody = `
    <div style="font-family: Ubuntu, Calibri, Arial, sans-serif; max-width: 600px;">
      <div style="background: #272251; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">📋 TEST: Weekly Feedback Reminder</h1>
      </div>
      <div style="background: #f5f5f7; padding: 25px; border-radius: 0 0 8px 8px;">
        <p>This is a test email from the Weekly Feedback System.</p>
        <p>If you received this, the email system is working correctly!</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${formUrl}" style="background: #272251; color: #fff; padding: 14px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Submit Feedback →
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    GmailApp.sendEmail(testEmail, '📋 TEST: Weekly Feedback Reminder', 'Test email', {
      htmlBody: htmlBody,
      name: 'Weekly Feedback System'
    });
    Logger.log('✅ Test email sent to: ' + testEmail);
  } catch (e) {
    Logger.log('❌ Failed to send test email: ' + e.toString());
  }
}

/**
 * Generate report for a specific week (or current week if not specified)
 * Used by both scheduled trigger and web UI
 */
function generateWeeklyReportForWeek(weekNumber, year) {
  const config = getConfig();
  
  // Default to current week
  const now = new Date();
  const targetWeek = weekNumber || parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const targetYear = year || now.getFullYear();
  
  Logger.log('Generating report for Week ' + targetWeek + ', ' + targetYear);
  
  // Get responses for specified week
  const responses = getResponsesForWeek(targetWeek, targetYear);
  
  if (responses.length === 0) {
    Logger.log('No responses for Week ' + targetWeek);
    
    // Try to send notification (will silently fail if no Gmail permission)
    sendNoResponsesEmail(config);
    return null;
  }
  
  Logger.log('Found ' + responses.length + ' responses');
  
  // Generate AI summary
  const aiAnalysis = generateAIAnalysis(responses, config);
  
  // Create Google Doc report
  const docUrl = createReportDocForWeek(responses, aiAnalysis, config, targetWeek, targetYear);
  
  // Try to send email (will silently fail if no Gmail permission)
  sendReportEmailForWeek(docUrl, responses.length, config, targetWeek, targetYear);
  
  Logger.log('Report generated: ' + docUrl);
  return docUrl;
}

/**
 * Get responses for a specific week
 */
function getResponsesForWeek(weekNumber, year) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  const responses = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowWeek = row[9];  // Week Number column
    const rowYear = row[10]; // Year column
    
    if (rowWeek == weekNumber && rowYear == year) {
      responses.push({
        timestamp: row[0],
        name: row[1],
        email: row[2],
        accomplishments: row[3],
        blockers: row[4],
        priorities: row[5],
        aiSummary: row[6],
        aiQuestion: row[7],
        aiAnswer: row[8]
      });
    }
  }
  
  return responses;
}

/**
 * Create report doc for specific week
 */
function createReportDocForWeek(responses, analysis, config, weekNumber, year) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Europe/London', 'EEEE, d MMMM yyyy');
  
  const docTitle = `Team Pulse - Week ${weekNumber}, ${year}`;
  const doc = DocumentApp.create(docTitle);
  const body = doc.getBody();
  
  // Move to folder if specified
  if (config.reportFolderId) {
    try {
      const file = DriveApp.getFileById(doc.getId());
      const folder = DriveApp.getFolderById(config.reportFolderId);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (e) {
      Logger.log('Could not move to folder: ' + e.toString());
    }
  }
  
  // Styles
  const styles = {
    title: {
      [DocumentApp.Attribute.FONT_SIZE]: 24,
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#272251'
    },
    subtitle: {
      [DocumentApp.Attribute.FONT_SIZE]: 11,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#666666',
      [DocumentApp.Attribute.ITALIC]: true
    },
    sectionHeader: {
      [DocumentApp.Attribute.FONT_SIZE]: 14,
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#272251'
    },
    normal: {
      [DocumentApp.Attribute.FONT_SIZE]: 10,
      [DocumentApp.Attribute.BOLD]: false,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#333333'
    },
    personName: {
      [DocumentApp.Attribute.FONT_SIZE]: 11,
      [DocumentApp.Attribute.BOLD]: true,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#272251'
    }
  };
  
  // Header
  const title = body.appendParagraph('📋 Team Pulse');
  title.setAttributes(styles.title);
  
  const subtitle = body.appendParagraph(`Week ${weekNumber}, ${year} • ${responses.length} of ${config.teamSize} responded • Generated ${dateStr}`);
  subtitle.setAttributes(styles.subtitle);
  subtitle.setSpacingAfter(20);
  
  // Needs Your Attention
  if (analysis.attentionItems && analysis.attentionItems.length > 0) {
    body.appendParagraph('').setSpacingAfter(10);
    const attentionHeader = body.appendParagraph('🚨 Needs Your Attention');
    attentionHeader.setAttributes(styles.sectionHeader);
    attentionHeader.setSpacingAfter(8);
    
    const attentionData = [['Who', 'Issue', 'Urgency']];
    analysis.attentionItems.forEach(item => {
      attentionData.push([item.who || '', item.issue || '', item.urgency || '']);
    });
    
    const attentionTable = body.appendTable(attentionData);
    formatTable(attentionTable);
  }
  
  // Wins This Week
  if (analysis.wins && analysis.wins.length > 0) {
    body.appendParagraph('').setSpacingAfter(10);
    const winsHeader = body.appendParagraph('📈 Wins This Week');
    winsHeader.setAttributes(styles.sectionHeader);
    winsHeader.setSpacingAfter(8);
    
    analysis.wins.forEach(win => {
      const winItem = body.appendListItem(win);
      winItem.setGlyphType(DocumentApp.GlyphType.BULLET);
      winItem.setAttributes(styles.normal);
    });
  }
  
  // Themes to Watch
  if (analysis.themes && analysis.themes.length > 0) {
    body.appendParagraph('').setSpacingAfter(10);
    const themesHeader = body.appendParagraph('⚠️ Themes to Watch');
    themesHeader.setAttributes(styles.sectionHeader);
    themesHeader.setSpacingAfter(8);
    
    analysis.themes.forEach(theme => {
      const themeItem = body.appendListItem(theme);
      themeItem.setGlyphType(DocumentApp.GlyphType.BULLET);
      themeItem.setAttributes(styles.normal);
    });
  }
  
  // Individual Summaries
  body.appendParagraph('').setSpacingAfter(15);
  const individualHeader = body.appendParagraph('👥 Individual Summaries');
  individualHeader.setAttributes(styles.sectionHeader);
  individualHeader.setSpacingAfter(10);
  
  if (analysis.individualSummaries) {
    analysis.individualSummaries.forEach(person => {
      const roleText = person.role ? ` — ${person.role}` : '';
      const nameP = body.appendParagraph(`${person.name}${roleText}`);
      nameP.setAttributes(styles.personName);
      nameP.setSpacingAfter(2);
      
      const summaryP = body.appendParagraph(person.summary);
      summaryP.setAttributes(styles.normal);
      summaryP.setSpacingAfter(12);
    });
  }
  
  // Footer
  body.appendParagraph('').setSpacingAfter(20);
  const footer = body.appendParagraph('— Generated by Weekly Feedback System');
  footer.setAttributes(styles.subtitle);
  
  doc.saveAndClose();
  
  return doc.getUrl();
}

/**
 * Send report email for specific week (optional - only used by scheduled trigger)
 * Note: This requires Gmail permission. If you don't want to grant Gmail access,
 * comment out the GmailApp.sendEmail line and the report will still be generated.
 */
function sendReportEmailForWeek(docUrl, responseCount, config, weekNumber, year) {
  const subject = `📋 Team Pulse - Week ${weekNumber}, ${year} (${responseCount} of ${config.teamSize} responded)`;
  
  const htmlBody = `
    <div style="font-family: Ubuntu, Calibri, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #272251; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📋 Team Pulse</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Week ${weekNumber}, ${year}</p>
      </div>
      
      <div style="background: #f5f5f7; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="color: #333; font-size: 14px; line-height: 1.6;">
          Your weekly team feedback report is ready. <strong>${responseCount} of ${config.teamSize}</strong> team members submitted their updates.
        </p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${docUrl}" style="background: #ffd618; color: #272251; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View Report →
          </a>
        </div>
        
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          This report was automatically generated from your Weekly Feedback form responses.
        </p>
      </div>
    </div>
  `;
  
  try {
    GmailApp.sendEmail(config.reportRecipient, subject, `Your weekly team report is ready: ${docUrl}`, {
      htmlBody: htmlBody,
      name: 'Weekly Feedback System'
    });
    Logger.log('Report email sent to: ' + config.reportRecipient);
  } catch (e) {
    // Gmail permission not granted - just log the URL
    Logger.log('Email not sent (no Gmail permission). Report URL: ' + docUrl);
  }
}

// ========================================
// ADMIN DASHBOARD API HANDLERS (v2.4)
// ========================================

/**
 * Get weekly submission status for all team members
 * Returns list of team members with their submission status
 */
function handleGetWeeklyStatus(data) {
  Logger.log('Getting weekly status...');

  const now = new Date();
  const currentWeek = parseInt(Utilities.formatDate(now, 'Europe/London', 'w'));
  const currentYear = now.getFullYear();

  // Get all active team members
  const teamMembers = getActiveTeamMembers();

  // Get this week's responses
  const responses = getResponsesForWeek(currentWeek, currentYear);
  const submitterEmails = responses.map(r => r.email.toLowerCase().trim());

  // Build status list for each team member
  const statusList = teamMembers.map(member => {
    const hasSubmitted = submitterEmails.includes(member.email.toLowerCase().trim());
    const submission = responses.find(r => r.email.toLowerCase().trim() === member.email.toLowerCase().trim());

    return {
      email: member.email,
      name: member.name,
      role: member.role || '',
      status: hasSubmitted ? 'submitted' : 'pending',
      submittedAt: submission ? submission.timestamp : null
    };
  });

  // Sort: pending first, then by name
  statusList.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const submittedCount = statusList.filter(s => s.status === 'submitted').length;
  const pendingCount = statusList.filter(s => s.status === 'pending').length;

  Logger.log(`Weekly status: ${submittedCount} submitted, ${pendingCount} pending`);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    week: currentWeek,
    year: currentYear,
    submittedCount: submittedCount,
    pendingCount: pendingCount,
    totalCount: statusList.length,
    members: statusList
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Send chase email to a single team member
 * data: { email: string, subject?: string, body?: string }
 */
function handleSendChaseEmail(data) {
  const email = data.email;

  if (!email) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Email address is required'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log('Sending chase email to: ' + email);

  // Get team member info
  const teamMembers = getActiveTeamMembers();
  const member = teamMembers.find(m => m.email.toLowerCase().trim() === email.toLowerCase().trim());
  const name = member ? member.name.split(' ')[0] : email.split('@')[0];

  const formUrl = 'https://tools.kubagroup.com/weekly';
  const subject = data.subject || 'Reminder: Weekly Feedback';

  // Simple plain text email body
  const plainBody = data.body || `Hi ${name},

Just a gentle reminder to submit your weekly feedback. It only takes a few minutes and helps keep the team connected.

Submit here: ${formUrl}

Please submit by Thursday to be included in the weekly report.

Thanks,
Aaron`;

  try {
    GmailApp.sendEmail(email, subject, plainBody);
    Logger.log('Chase email sent to: ' + email);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Chase email sent to ' + email
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    Logger.log('Failed to send chase email: ' + e.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Failed to send email: ' + e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Send chase emails to multiple team members
 * data: { emails: string[], subject?: string, body?: string }
 */
function handleSendBulkChase(data) {
  const emails = data.emails || [];

  if (emails.length === 0) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'No email addresses provided'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log('Sending bulk chase to ' + emails.length + ' people');

  const results = {
    sent: [],
    failed: []
  };

  // Get team members once for efficiency
  const teamMembers = getActiveTeamMembers();
  const formUrl = 'https://tools.kubagroup.com/weekly';
  const subject = data.subject || 'Reminder: Weekly Feedback';

  emails.forEach(email => {
    try {
      const member = teamMembers.find(m => m.email.toLowerCase().trim() === email.toLowerCase().trim());
      const name = member ? member.name.split(' ')[0] : email.split('@')[0];

      const plainBody = data.body || `Hi ${name},

Just a gentle reminder to submit your weekly feedback. It only takes a few minutes and helps keep the team connected.

Submit here: ${formUrl}

Please submit by Thursday to be included in the weekly report.

Thanks,
Aaron`;

      GmailApp.sendEmail(email, subject, plainBody);

      results.sent.push(email);
      Logger.log('Sent to: ' + email);

    } catch (e) {
      results.failed.push({ email: email, error: e.toString() });
      Logger.log('Failed for ' + email + ': ' + e.toString());
    }
  });

  Logger.log('Bulk chase complete: ' + results.sent.length + ' sent, ' + results.failed.length + ' failed');

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    sentCount: results.sent.length,
    failedCount: results.failed.length,
    sent: results.sent,
    failed: results.failed
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Send weekly prompt email to ALL team members
 * Used for manual sends when scheduled trigger was missed
 * data: { subject?: string, body?: string }
 */
function handleSendWeeklyPrompt(data) {
  Logger.log('Sending weekly prompt to all team members...');

  const teamMembers = getActiveTeamMembers();

  if (teamMembers.length === 0) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'No active team members found. Please check the Team Members sheet.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const formUrl = 'https://tools.kubagroup.com/weekly';
  const subject = data.subject || 'Weekly Feedback Time';

  const results = {
    sent: [],
    failed: []
  };

  teamMembers.forEach(member => {
    const name = member.name.split(' ')[0];

    const plainBody = data.body || `Hi ${name},

It's that time of the week! Please take a few minutes to share your accomplishments, blockers, and priorities.

Submit here: ${formUrl}

Please submit by Thursday to be included in the weekly report.

Thanks,
Aaron`;

    try {
      GmailApp.sendEmail(member.email, subject, plainBody);
      results.sent.push(member.email);
      Logger.log('Prompt sent to: ' + member.email);
    } catch (e) {
      results.failed.push({ email: member.email, error: e.toString() });
      Logger.log('Failed for ' + member.email + ': ' + e.toString());
    }
  });

  Logger.log('Weekly prompt complete: ' + results.sent.length + ' sent, ' + results.failed.length + ' failed');

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    sentCount: results.sent.length,
    failedCount: results.failed.length,
    sent: results.sent,
    failed: results.failed
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Send weekly reminder email to pending team members only
 * data: { subject?: string, body?: string }
 */
function handleSendWeeklyReminder(data) {
  Logger.log('Sending weekly reminder to pending members...');

  const teamMembers = getActiveTeamMembers();
  const submitters = getThisWeekSubmitters();

  // Filter to only pending members
  const pending = teamMembers.filter(m => !submitters.includes(m.email.toLowerCase().trim()));

  if (pending.length === 0) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Everyone has already submitted!',
      sentCount: 0,
      failedCount: 0,
      sent: [],
      failed: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log('Pending members: ' + pending.length);

  const formUrl = 'https://tools.kubagroup.com/weekly';
  const subject = data.subject || 'Reminder: Weekly Feedback Due';

  const results = {
    sent: [],
    failed: []
  };

  pending.forEach(member => {
    const name = member.name.split(' ')[0];

    const plainBody = data.body || `Hi ${name},

This is a gentle reminder that we haven't received your weekly feedback yet. The report will be generated soon, and we'd love to include your updates!

Submit here: ${formUrl}

Takes only 5 minutes. Your input helps keep the team connected.

Thanks,
Aaron`;

    try {
      GmailApp.sendEmail(member.email, subject, plainBody);
      results.sent.push(member.email);
      Logger.log('Reminder sent to: ' + member.email);
    } catch (e) {
      results.failed.push({ email: member.email, error: e.toString() });
      Logger.log('Failed for ' + member.email + ': ' + e.toString());
    }
  });

  Logger.log('Weekly reminder complete: ' + results.sent.length + ' sent, ' + results.failed.length + ' failed');

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    sentCount: results.sent.length,
    failedCount: results.failed.length,
    sent: results.sent,
    failed: results.failed
  })).setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// TEST FUNCTIONS
// ========================================

/**
 * Test the report generation manually
 */
function testGenerateReport() {
  generateWeeklyReport();
}

/**
 * Test AI analysis with sample data
 */
function testAIAnalysis() {
  const config = getConfig();
  
  const sampleResponses = [
    {
      name: 'Tom Buerbaum',
      accomplishments: 'Atlassian standardisation progressed. Security bid support expanded.',
      blockers: 'Hiring key resources for Project Westlink and Ironbark.',
      priorities: 'Delivering Project Westlink and Project Ironbark ahead of schedule.',
      aiAnswer: 'Engineering Manager role for Manchester, targeting mid February.'
    },
    {
      name: 'Michael Hart',
      accomplishments: 'TfGM presentations complete. TfNSW BAFO submitted.',
      blockers: 'Approval for TTG event. Staff attrition in US and UK.',
      priorities: 'TfGM. Cash receipts.',
      aiAnswer: 'Impact on TfGM is minimal. Recruitment process underway.'
    }
  ];
  
  const analysis = generateAIAnalysis(sampleResponses, config);
  Logger.log(JSON.stringify(analysis, null, 2));
}

/**
 * Verify all configuration is set
 */
function testConfiguration() {
  const config = getConfig();
  
  Logger.log('=== Configuration Check ===');
  Logger.log('API Key: ' + (config.apiKey ? '✅ Set (' + config.apiKey.substring(0, 10) + '...)' : '❌ Not set'));
  Logger.log('Report Recipient: ' + (config.reportRecipient || '❌ Not set'));
  Logger.log('Team Size: ' + config.teamSize);
  Logger.log('Report Folder ID: ' + (config.reportFolderId || 'Not set (will save to root)'));
}

function testGenerateQuestion() {
  const mockData = {
    action: 'generate',
    firstName: 'Aaron',
    accomplishments: 'Completed the new payment API integration.',
    blockers: 'Waiting on IT for production access credentials.',
    priorities: 'Focus on Q1 revenue targets.'
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(mockData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

function testApiKeySetup() {
  const apiKey = getAnthropicApiKey();
  if (apiKey) {
    Logger.log('✅ API key is configured');
  } else {
    Logger.log('❌ API key NOT configured');
  }
}

/**
 * Test the action routing - run this to verify doPost routes correctly
 */
function testActionRouting() {
  // Test 'generate' action
  const generateEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'generate',
        firstName: 'Test',
        accomplishments: 'Completed testing',
        blockers: 'None',
        priorities: 'Fix bugs'
      })
    }
  };

  const generateResult = doPost(generateEvent);
  const generateContent = JSON.parse(generateResult.getContent());
  Logger.log('=== GENERATE ACTION TEST ===');
  Logger.log('Result: ' + JSON.stringify(generateContent));
  Logger.log('Has summary field: ' + (generateContent.summary !== undefined));
  Logger.log('Has question field: ' + (generateContent.question !== undefined));

  // Test 'submit' action
  const submitEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'submit',
        timestamp: new Date().toISOString(),
        name: 'Test User',
        email: 'test@test.com',
        accomplishments: 'Test accomplishment',
        blockers: 'Test blocker',
        priorities: 'Test priority',
        aiSummary: 'Test summary',
        aiQuestion: 'Test question',
        aiAnswer: 'Test answer'
      })
    }
  };

  const submitResult = doPost(submitEvent);
  const submitContent = JSON.parse(submitResult.getContent());
  Logger.log('=== SUBMIT ACTION TEST ===');
  Logger.log('Result: ' + JSON.stringify(submitContent));
  Logger.log('Has message field: ' + (submitContent.message !== undefined));
}
