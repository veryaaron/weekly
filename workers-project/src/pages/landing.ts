/**
 * Tools Landing Page
 *
 * Main entry point for tools.kubapay.workers.dev
 * Lists all available internal tools
 */

export function getLandingPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kuba Tools</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --kuba-navy: #272251;
            --kuba-yellow: #ffd618;
            --kuba-coral: #e9426d;
            --kuba-green: #00a870;
            --bg-primary: #fafafa;
            --bg-card: #ffffff;
            --text-primary: #1a1a2e;
            --text-secondary: #6b7280;
            --border-color: #e5e7eb;
            --shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg-primary: #0f0f1a;
                --bg-card: #1a1a2e;
                --text-primary: #f8fafc;
                --text-secondary: #94a3b8;
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
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            margin-bottom: 60px;
            padding-top: 40px;
        }

        .logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-bottom: 16px;
        }

        .logo svg {
            width: 48px;
            height: 48px;
        }

        .logo h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.02em;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.125rem;
        }

        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-bottom: 60px;
        }

        .tool-card {
            background: var(--bg-card);
            border-radius: 16px;
            padding: 32px;
            box-shadow: var(--shadow);
            border: 1px solid var(--border-color);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .tool-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        }

        .tool-icon {
            width: 56px;
            height: 56px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            margin-bottom: 20px;
        }

        .tool-icon.feedback {
            background: linear-gradient(135deg, var(--kuba-navy), #3a3470);
        }

        .tool-icon.admin {
            background: linear-gradient(135deg, var(--kuba-yellow), #ffb800);
        }

        .tool-icon.coming-soon {
            background: var(--border-color);
        }

        .tool-card h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .tool-card p {
            color: var(--text-secondary);
            font-size: 0.95rem;
            line-height: 1.6;
        }

        .tool-card.disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .tool-card.disabled:hover {
            transform: none;
            box-shadow: var(--shadow);
        }

        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 500;
            margin-left: 8px;
            vertical-align: middle;
        }

        .badge.new {
            background: var(--kuba-green);
            color: white;
        }

        .badge.soon {
            background: var(--border-color);
            color: var(--text-secondary);
        }

        footer {
            text-align: center;
            padding: 40px 0;
            border-top: 1px solid var(--border-color);
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        footer a {
            color: var(--kuba-navy);
            text-decoration: none;
        }

        @media (prefers-color-scheme: dark) {
            footer a {
                color: var(--kuba-yellow);
            }
        }

        @media (max-width: 640px) {
            .logo h1 {
                font-size: 2rem;
            }

            .tools-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <svg viewBox="0 0 48 48" fill="none">
                    <path d="M0 48 Q24 48 24 24 Q24 0 48 0" stroke="#ffd618" stroke-width="5" fill="none"/>
                </svg>
                <h1>Kuba Tools</h1>
            </div>
            <p class="subtitle">Internal tools for the Kuba team</p>
        </header>

        <div class="tools-grid">
            <!-- Weekly Feedback -->
            <a href="/feedback" class="tool-card">
                <div class="tool-icon feedback">
                    <span style="color: white;">📋</span>
                </div>
                <h2>Weekly Feedback <span class="badge new">v2.2</span></h2>
                <p>Submit your weekly accomplishments, blockers, and priorities. AI-powered follow-up questions and progress tracking.</p>
            </a>

            <!-- Admin Dashboard -->
            <a href="/admin" class="tool-card">
                <div class="tool-icon admin">
                    <span>📊</span>
                </div>
                <h2>Admin Dashboard</h2>
                <p>Generate weekly reports, view submission status, and manage team feedback. Admin access required.</p>
            </a>

            <!-- Coming Soon: Expenses -->
            <div class="tool-card disabled">
                <div class="tool-icon coming-soon">
                    <span>💰</span>
                </div>
                <h2>Expense Tracker <span class="badge soon">Coming Soon</span></h2>
                <p>Track and submit expenses, attach receipts, and get approvals faster.</p>
            </div>

            <!-- Coming Soon: Time Off -->
            <div class="tool-card disabled">
                <div class="tool-icon coming-soon">
                    <span>🏖️</span>
                </div>
                <h2>Time Off Requests <span class="badge soon">Coming Soon</span></h2>
                <p>Request time off, view team calendars, and manage leave balances.</p>
            </div>
        </div>

        <footer>
            <p>Kuba Group Internal Tools &middot; <a href="mailto:support@kubapay.com">Need Help?</a></p>
        </footer>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
