import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search   = '';
  const res = NextResponse.redirect(url);
  res.cookies.set('snap_portal_auth', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  });
  return res;
}
