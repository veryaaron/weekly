/**
 * Kuba Tools - Cloudflare Worker
 *
 * Main entry point for tools.kubagroup.com
 * Handles routing between landing page, weekly report form, and admin dashboard
 * Static assets (JS, CSS) are served automatically via the assets configuration
 */

import { getLandingPage } from './pages/landing';
import { getAdminPage } from './pages/admin';

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // Route: Landing page
      if (path === '/' || path === '/index.html') {
        return getLandingPage();
      }

      // Route: Weekly report form - serve the static index.html
      if (path === '/weekly' || path === '/weekly/') {
        // Fetch the index.html from assets
        const assetUrl = new URL('/index.html', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // Route: Admin dashboard
      if (path === '/admin' || path === '/admin/') {
        return getAdminPage();
      }

      // Route: Static assets for /weekly path (rewrite to root)
      if (path.startsWith('/weekly/')) {
        const filename = path.replace('/weekly/', '/');
        const assetUrl = new URL(filename, request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // Let assets handle other static files (app.js, styles.css, etc.)
      // This will be handled by Cloudflare's assets automatically
      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
