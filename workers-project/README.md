# Kuba Tools - Cloudflare Workers

Internal tools for the Kuba team, deployed on Cloudflare Workers.

## Live URLs

- **Staging**: https://kuba-tools-staging.kubapay.workers.dev
- **Production**: https://tools.kubagroup.com (when DNS configured)

## Features

- **Landing Page** (`/`) - Overview of all available tools
- **Weekly Feedback** (`/feedback`) - Team feedback form with AI follow-up questions
- **Admin Dashboard** (`/admin`) - Generate reports, view submission status

## Development

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

### Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Start development server
npm run dev
```

### Local Development

The development server runs at `http://localhost:8787`

- `/` - Landing page
- `/feedback` - Weekly feedback form
- `/admin` - Admin dashboard

## Deployment

### Staging (tools.kubapay.workers.dev)

```bash
npm run deploy:staging
```

### Production (tools.kubagroup.com)

1. Configure DNS in Cloudflare dashboard:
   - Add CNAME record: `tools` → `kuba-tools.kubapay.workers.dev`
2. Uncomment routes in `wrangler.toml`
3. Deploy:

```bash
npm run deploy:production
```

## Project Structure

```
workers-project/
├── wrangler.toml        # Cloudflare config
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts         # Main router
│   └── pages/
│       ├── landing.ts   # Tools landing page
│       └── admin.ts     # Admin dashboard
└── public/              # Static files (feedback form)
    ├── index.html
    ├── app.js
    ├── config.js
    ├── questions.js
    └── styles.css
```

## Configuration

### Environment Variables

Set via Cloudflare dashboard or `wrangler secret`:

- None required currently (all config is in `public/config.js`)

### Google OAuth

To enable Google Sign-In on a new domain:

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized JavaScript origins:
   - `https://kuba-tools-staging.kubapay.workers.dev`
   - `https://tools.kubagroup.com` (when ready)
4. Save changes

### Google Apps Script

The backend remains on Google Apps Script. No changes needed for the Workers migration.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2.0 | 2025-02-04 | Cloudflare Workers migration, tools landing page, admin dashboard |

## Troubleshooting

### OAuth not working

- Check authorized origins in Google Cloud Console
- Clear browser cookies and try again
- Check browser console for errors

### Static files not loading

- Ensure files exist in `public/` directory
- Check wrangler.toml `[site]` configuration
- Try `wrangler publish --dry-run` to see what's being deployed

### Worker errors

- Check Cloudflare dashboard → Workers → Logs
- Use `wrangler tail` for real-time logs
