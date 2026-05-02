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

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API routes except protected ones (API routes handle their own auth where needed)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Get session token
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // Redirect to login
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
    // Invalid/expired token — clear cookie and redirect
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // Role-based access: staff cannot access admin-only paths
  if (payload.role === 'staff') {
    const isAdminOnly = ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (isAdminOnly) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Inject agent info into headers for server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-agent-id', payload.agentId);
  requestHeaders.set('x-agent-name', payload.name);
  requestHeaders.set('x-agent-role', payload.role);
  requestHeaders.set('x-pathname', pathname);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
