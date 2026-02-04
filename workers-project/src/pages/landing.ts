/**
 * Tools Landing Page - Clean Design v2.4
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
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
            --radius: 12px;
            --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
            --shadow-lg: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
        }

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--gray-50);
            color: var(--gray-800);
            line-height: 1.5;
            min-height: 100vh;
        }

        .header {
            background: var(--white);
            border-bottom: 1px solid var(--gray-100);
            padding: 16px 24px;
        }

        .header-content {
            max-width: 900px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-icon {
            flex-shrink: 0;
        }

        .logo-text {
            font-size: 20px;
            font-weight: 600;
            color: var(--gray-900);
        }

        .main {
            max-width: 900px;
            margin: 0 auto;
            padding: 48px 24px;
        }

        .hero {
            text-align: center;
            margin-bottom: 48px;
        }

        .hero h1 {
            font-size: 32px;
            font-weight: 600;
            color: var(--gray-900);
            margin-bottom: 8px;
        }

        .hero p {
            font-size: 16px;
            color: var(--gray-500);
        }

        .tools-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .tool-card {
            background: var(--white);
            border-radius: var(--radius);
            padding: 24px;
            box-shadow: var(--shadow);
            text-decoration: none;
            color: inherit;
            display: block;
            transition: box-shadow 0.15s, transform 0.15s;
            border: 1px solid var(--gray-100);
        }

        .tool-card:hover {
            box-shadow: var(--shadow-lg);
            transform: translateY(-2px);
        }

        .tool-card.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .tool-card.disabled:hover {
            transform: none;
            box-shadow: var(--shadow);
        }

        .tool-icon {
            width: 48px;
            height: 48px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 16px;
        }

        .tool-icon.weekly {
            background: var(--brand-navy);
            color: white;
        }

        .tool-icon.admin {
            background: linear-gradient(135deg, var(--brand-yellow), #ffb800);
        }

        .tool-icon.coming {
            background: var(--gray-100);
        }

        .tool-card h2 {
            font-size: 16px;
            font-weight: 600;
            color: var(--gray-900);
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tool-card p {
            font-size: 14px;
            color: var(--gray-500);
            line-height: 1.5;
        }

        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
        }

        .badge.new {
            background: #d1fae5;
            color: var(--brand-green);
        }

        .badge.soon {
            background: var(--gray-100);
            color: var(--gray-500);
        }

        .footer {
            max-width: 900px;
            margin: 0 auto;
            padding: 32px 24px;
            text-align: center;
            border-top: 1px solid var(--gray-200);
            margin-top: 48px;
        }

        .footer p {
            font-size: 13px;
            color: var(--gray-400);
        }

        .footer a {
            color: var(--brand-navy);
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        /* Kuba brand accent - subtle yellow line */
        .brand-accent {
            height: 3px;
            background: linear-gradient(90deg, var(--brand-yellow), transparent);
            width: 60px;
        }

        @media (max-width: 640px) {
            .hero h1 { font-size: 26px; }
            .tools-grid { grid-template-columns: 1fr; }
            .main { padding: 32px 16px; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            <svg class="logo-icon" viewBox="0 0 32 32" width="32" height="32">
                <path d="M0 32 Q16 32 16 16 Q16 0 32 0" fill="none" stroke="#ffd618" stroke-width="3"/>
            </svg>
            <span class="logo-text">Kuba Tools</span>
        </div>
    </header>

    <main class="main">
        <div class="hero">
            <div class="brand-accent" style="margin: 0 auto 16px;"></div>
            <h1>Internal Tools</h1>
            <p>Quick access to team resources</p>
        </div>

        <div class="tools-grid">
            <a href="/weekly" class="tool-card">
                <div class="tool-icon weekly">📋</div>
                <h2>Weekly Feedback <span class="badge new">v2.4</span></h2>
                <p>Submit your weekly accomplishments, blockers, and priorities with AI-powered follow-ups.</p>
            </a>

            <a href="/admin" class="tool-card">
                <div class="tool-icon admin">⚙️</div>
                <h2>Admin Dashboard</h2>
                <p>Manage weekly emails, view responses, generate reports, and send reminders.</p>
            </a>

            <div class="tool-card disabled">
                <div class="tool-icon coming">💰</div>
                <h2>Expenses <span class="badge soon">Soon</span></h2>
                <p>Track and submit expenses with receipt uploads.</p>
            </div>

            <div class="tool-card disabled">
                <div class="tool-icon coming">🏖️</div>
                <h2>Time Off <span class="badge soon">Soon</span></h2>
                <p>Request time off and view team calendars.</p>
            </div>
        </div>
    </main>

    <footer class="footer">
        <p>Kuba Group · <a href="mailto:support@kubapay.com">Need help?</a></p>
    </footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
