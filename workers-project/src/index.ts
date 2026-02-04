/**
 * Kuba Tools - Cloudflare Worker
 *
 * Main entry point for tools.kubagroup.com
 * Handles routing between landing page, weekly report form, and admin dashboard
 */

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { getLandingPage } from './pages/landing';
import { getAdminPage } from './pages/admin';

export interface Env {
  __STATIC_CONTENT: KVNamespace;
  __STATIC_CONTENT_MANIFEST: string;
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

      // Route: Weekly report form
      if (path === '/weekly' || path === '/weekly/') {
        return await serveStaticAsset(request, env, ctx, 'index.html');
      }

      // Route: Admin dashboard
      if (path === '/admin' || path === '/admin/') {
        return getAdminPage();
      }

      // Route: Static assets for /weekly (CSS, JS, etc.)
      if (path.startsWith('/weekly/')) {
        const filename = path.replace('/weekly/', '');
        return await serveStaticAsset(request, env, ctx, filename);
      }

      // Route: Root-level static assets (fallback)
      const staticFiles = ['app.js', 'config.js', 'questions.js', 'styles.css'];
      const filename = path.replace('/', '');
      if (staticFiles.includes(filename)) {
        return await serveStaticAsset(request, env, ctx, filename);
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
 * Serve a static asset from KV storage
 */
async function serveStaticAsset(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  filename: string
): Promise<Response> {
  try {
    // Create a new request for the specific file
    const url = new URL(request.url);
    url.pathname = '/' + filename;
    const assetRequest = new Request(url.toString(), request);

    return await getAssetFromKV(
      {
        request: assetRequest,
        waitUntil: ctx.waitUntil.bind(ctx),
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: JSON.parse(env.__STATIC_CONTENT_MANIFEST),
      }
    );
  } catch (e) {
    // If asset not found, return 404
    console.error(`Asset not found: ${filename}`, e);
    return new Response(`Not Found: ${filename}`, { status: 404 });
  }
}
