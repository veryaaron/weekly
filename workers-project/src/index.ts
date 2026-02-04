/**
 * Kuba Tools - Cloudflare Worker
 *
 * Main entry point for tools.kubagroup.com
 * Handles routing between landing page, feedback form, and admin dashboard
 */

import { getLandingPage } from './pages/landing';
import { getAdminPage } from './pages/admin';

export interface Env {
  // Environment variables can be added here
  // GOOGLE_SCRIPT_URL?: string;
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

      // Route: Weekly feedback form
      if (path === '/feedback' || path === '/feedback/' || path === '/feedback/index.html') {
        return await serveStaticFile('index.html', request);
      }

      // Route: Admin dashboard
      if (path === '/admin' || path === '/admin/') {
        return getAdminPage();
      }

      // Route: Static assets (CSS, JS, etc.)
      const staticPaths = [
        '/app.js',
        '/config.js',
        '/questions.js',
        '/styles.css',
        '/feedback/app.js',
        '/feedback/config.js',
        '/feedback/questions.js',
        '/feedback/styles.css',
      ];

      if (staticPaths.some(p => path.endsWith(p.split('/').pop()!))) {
        const filename = path.split('/').pop()!;
        return await serveStaticFile(filename, request);
      }

      // 404 for everything else
      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

/**
 * Serve a static file from the public directory
 * In production, Cloudflare Pages/Workers will serve from the [site] bucket
 */
async function serveStaticFile(filename: string, request: Request): Promise<Response> {
  // This is a placeholder - in production, wrangler handles static assets
  // For now, we'll redirect to the feedback form assets

  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
  };

  const ext = '.' + filename.split('.').pop();
  const contentType = contentTypes[ext] || 'text/plain';

  // The actual file serving is handled by wrangler's [site] configuration
  // This function is for development/fallback only
  return new Response(`File: ${filename}`, {
    headers: { 'Content-Type': contentType },
  });
}
