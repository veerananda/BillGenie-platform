import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_BASE_URL =
  process.env.PLATFORM_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://billgenie-api.fly.dev';

async function proxyRequest(req: NextRequest, segments: string[]) {
  const path = segments.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_API_BASE_URL}/platform/${path}${search}`;

  const apiKey =
    req.headers.get('x-platform-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  const actor = req.headers.get('x-platform-actor') || 'platform_console';

  if (!apiKey) {
    return NextResponse.json({ error: 'missing platform api key' }, { status: 401 });
  }

  const headers = new Headers();
  headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
  headers.set('X-Platform-Api-Key', apiKey);
  headers.set('X-Platform-Actor', actor);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  const upstream = await fetch(targetUrl, init);
  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}
