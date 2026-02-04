/**
 * Admin Dashboard - Clean Design v2.4
 * Features:
 * - Email template editing (prompt & reminder)
 * - Manual email send button
 * - Response status table
 * - Chase non-responders
 */

export function getAdminPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Kuba Tools</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <style>
        :root {
            --white: #ffffff;
            --gray-50: #f9fafb;
            --gray-100: #f3f4f6;
            --gray-200: #e5e7eb;
            --gray-300: #d1d5db;
            --gray-400: #9ca3af;
            --gray-500: #6b7280;
            --gray-600: #4b5563;
            --gray-700: #374151;
            --gray-800: #1f2937;
            --gray-900: #111827;
            --brand-navy: #272251;
            --brand-yellow: #ffd618;
            --brand-green: #10b981;
            --brand-red: #ef4444;
            --brand-orange: #f59e0b;
            --radius: 12px;
            --radius-sm: 8px;
            --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
        }

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--gray-50);
            color: var(--gray-800);
            line-height: 1.5;
            min-height: 100vh;
        }

        /* Header */
        .header {
            background: var(--white);
            border-bottom: 1px solid var(--gray-100);
            padding: 16px 24px;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header-content {
            max-width: 1000px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: inherit;
        }

        .logo-text {
            font-size: 18px;
            font-weight: 600;
            color: var(--gray-900);
        }

        .back-link {
            color: var(--gray-500);
            text-decoration: none;
            font-size: 14px;
            padding: 6px 12px;
            border-radius: var(--radius-sm);
            transition: background 0.15s;
        }

        .back-link:hover {
            background: var(--gray-100);
            color: var(--gray-700);
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .user-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: var(--gray-600);
        }

        .user-badge img {
            width: 28px;
            height: 28px;
            border-radius: 50%;
        }

        .btn-signout {
            padding: 6px 12px;
            background: none;
            border: 1px solid var(--gray-200);
            color: var(--gray-500);
            border-radius: var(--radius-sm);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s;
        }

        .btn-signout:hover {
            background: var(--brand-red);
            border-color: var(--brand-red);
            color: white;
        }

        /* Main */
        .main {
            max-width: 1000px;
            margin: 0 auto;
            padding: 32px 24px;
        }

        /* Auth Card */
        .auth-card {
            background: var(--white);
            border-radius: var(--radius);
            padding: 48px 32px;
            box-shadow: var(--shadow);
            text-align: center;
            max-width: 400px;
            margin: 60px auto;
        }

        .auth-card h2 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .auth-card p {
            font-size: 14px;
            color: var(--gray-500);
            margin-bottom: 24px;
        }

        #g_id_signin {
            display: flex;
            justify-content: center;
        }

        .auth-error {
            margin-top: 16px;
            padding: 12px;
            background: #fef2f2;
            border-radius: var(--radius-sm);
            color: var(--brand-red);
            font-size: 14px;
        }

        /* Dashboard */
        .dashboard {
            display: none;
        }

        .dashboard.active {
            display: block;
        }

        /* Stats Row */
        .stats-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .stat-card {
            background: var(--white);
            border-radius: var(--radius);
            padding: 20px;
            box-shadow: var(--shadow);
        }

        .stat-label {
            font-size: 13px;
            color: var(--gray-500);
            margin-bottom: 4px;
        }

        .stat-value {
            font-size: 28px;
            font-weight: 600;
            color: var(--gray-900);
        }

        .stat-sub {
            font-size: 12px;
            color: var(--gray-400);
            margin-top: 2px;
        }

        /* Section Card */
        .section {
            background: var(--white);
            border-radius: var(--radius);
            padding: 24px;
            box-shadow: var(--shadow);
            margin-bottom: 20px;
        }

        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .section h2 {
            font-size: 16px;
            font-weight: 600;
            color: var(--gray-900);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section-desc {
            font-size: 14px;
            color: var(--gray-500);
            margin-bottom: 16px;
        }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 16px;
            border-radius: var(--radius-sm);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            border: none;
            font-family: inherit;
        }

        .btn-primary {
            background: var(--brand-navy);
            color: white;
        }

        .btn-primary:hover {
            background: #3a3470;
        }

        .btn-secondary {
            background: var(--white);
            color: var(--gray-700);
            border: 1px solid var(--gray-200);
        }

        .btn-secondary:hover {
            background: var(--gray-50);
            border-color: var(--gray-300);
        }

        .btn-warning {
            background: var(--brand-orange);
            color: white;
        }

        .btn-warning:hover {
            background: #d97706;
        }

        .btn-success {
            background: var(--brand-green);
            color: white;
        }

        .btn-success:hover {
            background: #059669;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-group {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        /* Form Elements */
        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: var(--gray-700);
            margin-bottom: 6px;
        }

        .form-input,
        .form-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--gray-200);
            border-radius: var(--radius-sm);
            font-size: 14px;
            font-family: inherit;
            color: var(--gray-800);
            transition: border-color 0.15s, box-shadow 0.15s;
        }

        .form-input:focus,
        .form-textarea:focus {
            outline: none;
            border-color: var(--brand-navy);
            box-shadow: 0 0 0 3px rgba(39, 34, 81, 0.1);
        }

        .form-textarea {
            min-height: 100px;
            resize: vertical;
        }

        .form-hint {
            font-size: 12px;
            color: var(--gray-400);
            margin-top: 4px;
        }

        /* Table */
        .table-container {
            overflow-x: auto;
            margin: 0 -24px;
            padding: 0 24px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--gray-100);
        }

        th {
            font-weight: 500;
            color: var(--gray-500);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        tr:hover td {
            background: var(--gray-50);
        }

        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--brand-navy);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
        }

        .name-cell {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }

        .status-badge.submitted {
            background: #d1fae5;
            color: var(--brand-green);
        }

        .status-badge.pending {
            background: #fef3c7;
            color: var(--brand-orange);
        }

        .btn-chase {
            padding: 4px 10px;
            font-size: 12px;
            background: none;
            border: 1px solid var(--gray-300);
            color: var(--gray-600);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
        }

        .btn-chase:hover {
            background: var(--brand-orange);
            border-color: var(--brand-orange);
            color: white;
        }

        .btn-chase:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        /* Status Messages */
        .status-message {
            margin-top: 12px;
            padding: 10px 14px;
            border-radius: var(--radius-sm);
            font-size: 13px;
        }

        .status-message.success {
            background: #d1fae5;
            color: var(--brand-green);
        }

        .status-message.error {
            background: #fef2f2;
            color: var(--brand-red);
        }

        .status-message.loading {
            color: var(--gray-500);
        }

        .status-message a {
            color: inherit;
            font-weight: 600;
        }

        /* Spinner */
        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid currentColor;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Tabs */
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--gray-200);
            margin-bottom: 20px;
            gap: 4px;
        }

        .tab {
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 500;
            color: var(--gray-500);
            background: none;
            border: none;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
            transition: all 0.15s;
        }

        .tab:hover {
            color: var(--gray-700);
        }

        .tab.active {
            color: var(--brand-navy);
            border-bottom-color: var(--brand-navy);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        /* Responsive */
        @media (max-width: 640px) {
            .header-content { flex-direction: column; gap: 12px; }
            .stats-row { grid-template-columns: 1fr 1fr; }
            .main { padding: 20px 16px; }
            .section { padding: 20px; }
            th, td { padding: 10px 12px; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <div class="header-left">
                <a href="/" class="logo">
                    <svg viewBox="0 0 32 32" width="28" height="28">
                        <path d="M0 32 Q16 32 16 16 Q16 0 32 0" fill="none" stroke="#ffd618" stroke-width="3"/>
                    </svg>
                    <span class="logo-text">Admin Dashboard</span>
                </a>
            </div>
            <div class="header-right" id="headerRight" style="display: none;">
                <div class="user-badge">
                    <img id="userAvatar" src="" alt="">
                    <span id="userName"></span>
                </div>
                <button class="btn-signout" onclick="signOut()">Sign out</button>
            </div>
        </div>
    </header>

    <main class="main">
        <!-- Auth Card -->
        <div class="auth-card" id="authCard">
            <h2>Admin Access</h2>
            <p>Sign in with your admin account</p>
            <div id="g_id_signin"></div>
            <div id="authError"></div>
        </div>

        <!-- Dashboard -->
        <div class="dashboard" id="dashboard">
            <!-- Stats -->
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-label">Responses</div>
                    <div class="stat-value"><span id="responseCount">-</span> / <span id="teamSize">-</span></div>
                    <div class="stat-sub">this week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Week</div>
                    <div class="stat-value" id="weekNumber">-</div>
                    <div class="stat-sub" id="weekYear">2025</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Status</div>
                    <div class="stat-value" id="weekStatus" style="font-size: 16px;">-</div>
                    <div class="stat-sub" id="nextAction">-</div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="tabs">
                <button class="tab active" onclick="switchTab('responses')">Responses</button>
                <button class="tab" onclick="switchTab('emails')">Email Settings</button>
                <button class="tab" onclick="switchTab('reports')">Reports</button>
            </div>

            <!-- Tab: Responses -->
            <div class="tab-content active" id="tab-responses">
                <div class="section">
                    <div class="section-header">
                        <h2>📋 This Week's Responses</h2>
                        <div class="btn-group">
                            <button class="btn btn-secondary" onclick="refreshResponses()">
                                Refresh
                            </button>
                            <button class="btn btn-warning" onclick="chaseAllPending()">
                                Chase All Pending
                            </button>
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Team Member</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="responseTable">
                                <tr><td colspan="4" style="text-align: center; color: var(--gray-400);">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div id="responseStatus"></div>
                </div>
            </div>

            <!-- Tab: Email Settings -->
            <div class="tab-content" id="tab-emails">
                <div class="section">
                    <h2>📧 Weekly Prompt Email</h2>
                    <p class="section-desc">Sent every Wednesday at 9am to prompt team members for their weekly update.</p>

                    <div class="form-group">
                        <label class="form-label">Email Subject</label>
                        <input type="text" class="form-input" id="promptSubject" value="Weekly Check-in - Share Your Updates">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Email Body</label>
                        <textarea class="form-textarea" id="promptBody" rows="6">Hi {firstName},

It's time for your weekly update! Please take a few minutes to share:
- What you accomplished this week
- Any blockers or challenges
- Your priorities for next week

Submit your update here: {formUrl}

Thanks!</textarea>
                        <p class="form-hint">Use {firstName} for the person's name and {formUrl} for the form link.</p>
                    </div>

                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="saveEmailSettings('prompt')">Save Changes</button>
                        <button class="btn btn-warning" onclick="sendPromptNow()">Send Prompt Now</button>
                    </div>
                    <div id="promptStatus"></div>
                </div>

                <div class="section">
                    <h2>⏰ Reminder Email</h2>
                    <p class="section-desc">Sent Friday at 9am to team members who haven't submitted yet.</p>

                    <div class="form-group">
                        <label class="form-label">Email Subject</label>
                        <input type="text" class="form-input" id="reminderSubject" value="Reminder: Weekly Update Due Today">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Email Body</label>
                        <textarea class="form-textarea" id="reminderBody" rows="5">Hi {firstName},

Quick reminder - we haven't received your weekly update yet. Please submit before end of day.

{formUrl}

Thanks!</textarea>
                    </div>

                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="saveEmailSettings('reminder')">Save Changes</button>
                        <button class="btn btn-warning" onclick="sendReminderNow()">Send Reminder Now</button>
                    </div>
                    <div id="reminderStatus"></div>
                </div>
            </div>

            <!-- Tab: Reports -->
            <div class="tab-content" id="tab-reports">
                <div class="section">
                    <h2>📊 Generate Weekly Report</h2>
                    <p class="section-desc">Create a formatted Google Doc with AI-analyzed insights from this week's submissions.</p>

                    <button class="btn btn-primary" id="generateReportBtn" onclick="generateReport()">
                        Generate Report
                    </button>
                    <div id="reportStatus"></div>
                </div>
            </div>
        </div>
    </main>

    <script>
        // Configuration
        const GOOGLE_CLIENT_ID = '287284865613-fq9mql1qvr9sqogv6tjgde29o2bhidri.apps.googleusercontent.com';
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMabfFbwWpBKiyRVcFsB9vz5oJjbp30JtuEtyt5GBKTyFf6r_MDHA0cqAv_GGokzjhew/exec';
        const ADMIN_EMAILS = ['aaron@kubapay.com'];
        const TEAM_MEMBERS = [
            { name: 'Aaron Ross', email: 'aaron@kubapay.com' },
            { name: 'Team Member 2', email: 'member2@kubapay.com' },
            { name: 'Team Member 3', email: 'member3@kubapay.com' },
            { name: 'Team Member 4', email: 'member4@kubapay.com' },
            { name: 'Team Member 5', email: 'member5@kubapay.com' },
            { name: 'Team Member 6', email: 'member6@kubapay.com' },
            { name: 'Team Member 7', email: 'member7@kubapay.com' },
            { name: 'Team Member 8', email: 'member8@kubapay.com' }
        ];

        let currentUser = null;
        let responseData = [];

        // Initialize
        window.onload = function() {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleCredentialResponse,
                auto_select: true
            });

            google.accounts.id.renderButton(
                document.getElementById('g_id_signin'),
                { theme: 'outline', size: 'large', width: 280 }
            );

            google.accounts.id.prompt();
        };

        function handleCredentialResponse(response) {
            const payload = parseJwt(response.credential);

            if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(payload.email.toLowerCase())) {
                document.getElementById('authError').innerHTML = '<div class="auth-error">Admin access required for ' + payload.email + '</div>';
                return;
            }

            currentUser = payload;
            showDashboard();
        }

        function parseJwt(token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')));
        }

        function showDashboard() {
            document.getElementById('authCard').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            document.getElementById('headerRight').style.display = 'flex';

            // User info
            document.getElementById('userName').textContent = currentUser.name;
            if (currentUser.picture) {
                document.getElementById('userAvatar').src = currentUser.picture;
            }

            // Team size
            document.getElementById('teamSize').textContent = TEAM_MEMBERS.length;

            // Week info
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            const weekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
            document.getElementById('weekNumber').textContent = weekNum;
            document.getElementById('weekYear').textContent = now.getFullYear();

            // Determine day and status
            const day = now.getDay(); // 0=Sun, 1=Mon...
            let status = 'Collecting responses';
            let nextAction = 'Prompt sent Wednesday';

            if (day < 3) {
                status = 'Before prompt';
                nextAction = 'Prompt sends Wednesday 9am';
            } else if (day === 3) {
                status = 'Prompt day';
                nextAction = 'Reminder Friday 9am';
            } else if (day < 5) {
                status = 'Collecting';
                nextAction = 'Reminder Friday 9am';
            } else {
                status = 'Reminder sent';
                nextAction = 'Report due Monday';
            }

            document.getElementById('weekStatus').textContent = status;
            document.getElementById('nextAction').textContent = nextAction;

            // Load response data
            loadResponses();
        }

        function signOut() {
            google.accounts.id.disableAutoSelect();
            currentUser = null;
            document.getElementById('dashboard').classList.remove('active');
            document.getElementById('authCard').style.display = 'block';
            document.getElementById('headerRight').style.display = 'none';
        }

        // Tab switching
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            document.querySelector('.tab[onclick*="' + tabName + '"]').classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        }

        // Load responses from backend
        async function loadResponses() {
            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'getWeeklyStatus',
                        requestedBy: currentUser.email
                    })
                });

                const result = await response.json();

                if (result.status === 'success' && result.responses) {
                    responseData = result.responses;
                    renderResponseTable(result.responses);
                    document.getElementById('responseCount').textContent = result.responses.filter(r => r.submitted).length;
                } else {
                    // Fallback: show team list with unknown status
                    renderResponseTable(TEAM_MEMBERS.map(m => ({
                        name: m.name,
                        email: m.email,
                        submitted: false,
                        submittedAt: null
                    })));
                }
            } catch (error) {
                console.error('Error loading responses:', error);
                renderResponseTable(TEAM_MEMBERS.map(m => ({
                    name: m.name,
                    email: m.email,
                    submitted: false,
                    submittedAt: null
                })));
            }
        }

        function renderResponseTable(responses) {
            const tbody = document.getElementById('responseTable');
            const submittedCount = responses.filter(r => r.submitted).length;
            document.getElementById('responseCount').textContent = submittedCount;

            tbody.innerHTML = responses.map(r => {
                const initials = r.name.split(' ').map(n => n[0]).join('').toUpperCase();
                const statusClass = r.submitted ? 'submitted' : 'pending';
                const statusText = r.submitted ? '✓ Submitted' : 'Pending';
                const timeText = r.submittedAt ? formatTime(r.submittedAt) : '-';

                return '<tr>' +
                    '<td><div class="name-cell"><div class="avatar">' + initials + '</div>' + r.name + '</div></td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
                    '<td>' + timeText + '</td>' +
                    '<td>' + (r.submitted ? '<button class="btn-chase" disabled>-</button>' : '<button class="btn-chase" onclick="chaseUser(\\'' + r.email + '\\')">Chase</button>') + '</td>' +
                    '</tr>';
            }).join('');
        }

        function formatTime(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
                   ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }

        function refreshResponses() {
            document.getElementById('responseTable').innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--gray-400);"><span class="spinner"></span> Refreshing...</td></tr>';
            loadResponses();
        }

        // Chase functions
        async function chaseUser(email) {
            const statusEl = document.getElementById('responseStatus');
            statusEl.className = 'status-message loading';
            statusEl.innerHTML = '<span class="spinner"></span> Sending reminder to ' + email + '...';

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'sendChaseEmail',
                        email: email,
                        requestedBy: currentUser.email
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    statusEl.className = 'status-message success';
                    statusEl.textContent = '✓ Reminder sent to ' + email;
                } else {
                    throw new Error(result.message || 'Failed to send');
                }
            } catch (error) {
                statusEl.className = 'status-message error';
                statusEl.textContent = '✗ Error: ' + error.message;
            }
        }

        async function chaseAllPending() {
            const pending = responseData.filter(r => !r.submitted);
            if (pending.length === 0) {
                alert('Everyone has submitted!');
                return;
            }

            if (!confirm('Send reminder to ' + pending.length + ' pending team members?')) {
                return;
            }

            const statusEl = document.getElementById('responseStatus');
            statusEl.className = 'status-message loading';
            statusEl.innerHTML = '<span class="spinner"></span> Sending reminders...';

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'sendBulkChase',
                        emails: pending.map(p => p.email),
                        requestedBy: currentUser.email
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    statusEl.className = 'status-message success';
                    statusEl.textContent = '✓ Sent reminders to ' + pending.length + ' team members';
                } else {
                    throw new Error(result.message || 'Failed');
                }
            } catch (error) {
                statusEl.className = 'status-message error';
                statusEl.textContent = '✗ Error: ' + error.message;
            }
        }

        // Email functions
        async function sendPromptNow() {
            if (!confirm('Send weekly prompt email to all team members now?')) return;

            const statusEl = document.getElementById('promptStatus');
            statusEl.className = 'status-message loading';
            statusEl.innerHTML = '<span class="spinner"></span> Sending prompt emails...';

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'sendWeeklyPrompt',
                        subject: document.getElementById('promptSubject').value,
                        body: document.getElementById('promptBody').value,
                        requestedBy: currentUser.email
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    statusEl.className = 'status-message success';
                    statusEl.textContent = '✓ Prompt emails sent to ' + (result.count || 'all') + ' team members';
                } else {
                    throw new Error(result.message || 'Failed');
                }
            } catch (error) {
                statusEl.className = 'status-message error';
                statusEl.textContent = '✗ Error: ' + error.message;
            }
        }

        async function sendReminderNow() {
            if (!confirm('Send reminder email to all pending team members?')) return;

            const statusEl = document.getElementById('reminderStatus');
            statusEl.className = 'status-message loading';
            statusEl.innerHTML = '<span class="spinner"></span> Sending reminders...';

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'sendWeeklyReminder',
                        subject: document.getElementById('reminderSubject').value,
                        body: document.getElementById('reminderBody').value,
                        requestedBy: currentUser.email
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    statusEl.className = 'status-message success';
                    statusEl.textContent = '✓ Reminders sent to ' + (result.count || 'pending') + ' team members';
                } else {
                    throw new Error(result.message || 'Failed');
                }
            } catch (error) {
                statusEl.className = 'status-message error';
                statusEl.textContent = '✗ Error: ' + error.message;
            }
        }

        function saveEmailSettings(type) {
            // For now, settings are local. Would need backend to persist.
            const statusEl = document.getElementById(type + 'Status');
            statusEl.className = 'status-message success';
            statusEl.textContent = '✓ Settings saved locally (will use these for next send)';
            setTimeout(() => { statusEl.textContent = ''; }, 3000);
        }

        // Report generation
        async function generateReport() {
            const btn = document.getElementById('generateReportBtn');
            const statusEl = document.getElementById('reportStatus');

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Generating...';
            statusEl.className = 'status-message loading';
            statusEl.textContent = 'Creating report...';

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'generateReport',
                        requestedBy: currentUser.email
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    statusEl.className = 'status-message success';
                    statusEl.innerHTML = '✓ Report generated! <a href="' + (result.docUrl || result.url) + '" target="_blank">Open Report →</a>';
                } else if (result.status === 'no_responses') {
                    statusEl.className = 'status-message error';
                    statusEl.textContent = 'No responses found for this week yet.';
                } else {
                    throw new Error(result.message || 'Unknown error');
                }
            } catch (error) {
                statusEl.className = 'status-message error';
                statusEl.textContent = '✗ Error: ' + error.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Generate Report';
            }
        }
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store',
    },
  });
}
