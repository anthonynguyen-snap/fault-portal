import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'snap_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-in-production';

// Pages that staff (non-admin) cannot access
const ADMIN_ONLY_PATHS = [
  '/reports',
  '/corporate',
  '/stock',
  '/replenishment',
  '/admin',
];

// Public paths that don't require auth
const PUBLIC_PATHS = ['/login'];

function getSecretKey() {
  return new TextEncoder().encode(SESSION_SECRET);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always inject x-pathname so the layout knows which page it's rendering
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Allow public paths through (with x-pathname injected so layout hides sidebar)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Allow auth API routes through — they handle their own logic
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Get session token
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes: return 401 JSON (don't redirect — the browser would follow it)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    // Pages: redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  let payload: { agentId: string; name: string; email: string; role: string; shiftLogId?: string };
  try {
    const { payload: p } = await jwtVerify(token, getSecretKey());
    payload = p as typeof payload;
  } catch {
    // Invalid/expired token
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // Role-based access: staff cannot access admin-only paths
  if (payload.role === 'staff') {
    const isAdminOnly = ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (isAdminOnly) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Inject agent info into headers for server components
  requestHeaders.set('x-agent-id', payload.agentId);
  requestHeaders.set('x-agent-name', payload.name);
  requestHeaders.set('x-agent-role', payload.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
