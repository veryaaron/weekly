/**
 * Admin Dashboard Page
 *
 * Provides admin functionality:
 * - View this week's submission status
 * - Generate weekly reports
 * - Manage team members
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
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <style>
        :root {
            --kuba-navy: #272251;
            --kuba-yellow: #ffd618;
            --kuba-coral: #e9426d;
            --kuba-green: #00a870;
            --bg-primary: #fafafa;
            --bg-card: #ffffff;
            --bg-input: #f8f9fa;
            --text-primary: #1a1a2e;
            --text-secondary: #6b7280;
            --text-muted: #9ca3af;
            --border-color: #e5e7eb;
            --shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg-primary: #0f0f1a;
                --bg-card: #1a1a2e;
                --bg-input: #252540;
                --text-primary: #f8fafc;
                --text-secondary: #94a3b8;
                --text-muted: #64748b;
                --border-color: #334155;
                --shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            padding: 24px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border-color);
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: inherit;
        }

        .logo svg {
            width: 32px;
            height: 32px;
        }

        .logo h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .back-link {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .back-link:hover {
            color: var(--text-primary);
        }

        .auth-card {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 48px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border-color);
            text-align: center;
            max-width: 400px;
            margin: 60px auto;
        }

        .auth-card h2 {
            margin-bottom: 8px;
            font-size: 1.25rem;
        }

        .auth-card p {
            color: var(--text-secondary);
            margin-bottom: 24px;
        }

        #g_id_signin {
            display: flex;
            justify-content: center;
        }

        .dashboard {
            display: none;
        }

        .dashboard.active {
            display: block;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .stat-card {
            background: var(--bg-card);
            border-radius: 12px;
            padding: 24px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border-color);
        }

        .stat-card .label {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 4px;
        }

        .stat-card .value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .stat-card .sublabel {
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .section {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 32px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border-color);
            margin-bottom: 24px;
        }

        .section h2 {
            font-size: 1.125rem;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .section p {
            color: var(--text-secondary);
            margin-bottom: 20px;
        }

        .btn {
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
            border: 2px solid transparent;
        }

        .btn-primary {
            background: var(--kuba-navy);
            color: white;
            border-color: var(--kuba-navy);
            width: 100%;
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(39, 34, 81, 0.3);
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        @media (prefers-color-scheme: dark) {
            .btn-primary {
                background: var(--kuba-yellow);
                color: var(--kuba-navy);
                border-color: var(--kuba-yellow);
            }
        }

        .status {
            margin-top: 16px;
            padding: 12px;
            border-radius: 8px;
            font-size: 0.9rem;
        }

        .status.success {
            background: rgba(0, 168, 112, 0.1);
            color: var(--kuba-green);
        }

        .status.error {
            background: rgba(233, 66, 109, 0.1);
            color: var(--kuba-coral);
        }

        .status.loading {
            color: var(--text-secondary);
        }

        .status a {
            color: inherit;
            font-weight: 600;
        }

        .submission-list {
            margin-top: 16px;
        }

        .submission-item {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--border-color);
        }

        .submission-item:last-child {
            border-bottom: none;
        }

        .submission-item .avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: var(--kuba-navy);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            margin-right: 12px;
            font-size: 0.85rem;
        }

        .submission-item .name {
            flex: 1;
        }

        .submission-item .time {
            color: var(--text-muted);
            font-size: 0.85rem;
        }

        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid currentColor;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 0.7s linear infinite;
            margin-right: 8px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .user-info img {
            width: 32px;
            height: 32px;
            border-radius: 50%;
        }

        .user-info .details {
            text-align: left;
        }

        .user-info .name {
            font-weight: 500;
            font-size: 0.9rem;
        }

        .user-info .email {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .btn-signout {
            padding: 8px 16px;
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            border-radius: 8px;
            font-size: 0.85rem;
            cursor: pointer;
        }

        .btn-signout:hover {
            background: var(--kuba-coral);
            border-color: var(--kuba-coral);
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <a href="/" class="logo">
                <svg viewBox="0 0 48 48" fill="none">
                    <path d="M0 48 Q24 48 24 24 Q24 0 48 0" stroke="#ffd618" stroke-width="5" fill="none"/>
                </svg>
                <h1>Admin Dashboard</h1>
            </a>
            <a href="/" class="back-link">← Back to Tools</a>
        </header>

        <!-- Auth Required -->
        <div class="auth-card" id="authCard">
            <h2>🔐 Admin Access Required</h2>
            <p>Sign in with your admin account to access the dashboard</p>
            <div id="g_id_signin"></div>
            <div id="authError"></div>
        </div>

        <!-- Dashboard (shown after auth) -->
        <div class="dashboard" id="dashboard">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Submissions This Week</div>
                    <div class="value" id="submissionCount">-</div>
                    <div class="sublabel">of <span id="teamSize">-</span> team members</div>
                </div>
                <div class="stat-card">
                    <div class="label">Current Week</div>
                    <div class="value" id="weekNumber">-</div>
                    <div class="sublabel" id="weekYear">2025</div>
                </div>
            </div>

            <div class="section">
                <h2>📊 Generate Report</h2>
                <p>Create a formatted Google Doc with AI-analyzed insights from this week's submissions.</p>
                <button class="btn btn-primary" id="generateReportBtn" onclick="generateReport()">
                    Generate Weekly Report
                </button>
                <div id="reportStatus"></div>
            </div>

            <div class="section">
                <h2>👥 This Week's Submissions</h2>
                <div id="submissionList" class="submission-list">
                    <p style="color: var(--text-muted);">Loading submissions...</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Configuration - update these values
        const GOOGLE_CLIENT_ID = '287284865613-fq9mql1qvr9sqogv6tjgde29o2bhidri.apps.googleusercontent.com';
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMabfFbwWpBKiyRVcFsB9vz5oJjbp30JtuEtyt5GBKTyFf6r_MDHA0cqAv_GGokzjhew/exec';
        const ADMIN_EMAILS = ['aaron@kubapay.com'];
        const TEAM_SIZE = 8;

        let currentUser = null;

        // Initialize Google Sign-In
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

            // Check if admin
            if (!ADMIN_EMAILS.includes(payload.email.toLowerCase())) {
                document.getElementById('authError').innerHTML =
                    '<p style="color: var(--kuba-coral); margin-top: 16px;">⛔ Admin access required</p>';
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

            // Set team size
            document.getElementById('teamSize').textContent = TEAM_SIZE;

            // Calculate week number
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            const weekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
            document.getElementById('weekNumber').textContent = weekNum;
            document.getElementById('weekYear').textContent = now.getFullYear();

            // Load submission status (would need backend support)
            document.getElementById('submissionList').innerHTML =
                '<p style="color: var(--text-muted);">View submissions in the feedback form admin panel.</p>';
            document.getElementById('submissionCount').textContent = '-';
        }

        async function generateReport() {
            const btn = document.getElementById('generateReportBtn');
            const statusEl = document.getElementById('reportStatus');

            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> Generating...';
            statusEl.className = 'status loading';
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
                    statusEl.className = 'status success';
                    statusEl.innerHTML = '✓ Report generated! <a href="' + result.docUrl + '" target="_blank">Open Report →</a>';
                } else if (result.status === 'no_responses') {
                    statusEl.className = 'status error';
                    statusEl.textContent = '⚠️ No responses found for this week yet.';
                } else {
                    throw new Error(result.message || 'Unknown error');
                }
            } catch (error) {
                statusEl.className = 'status error';
                statusEl.textContent = '❌ Error: ' + error.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Generate Weekly Report';
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
