import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    const correctPassword = process.env.PORTAL_PASSWORD;
    const secret          = process.env.PORTAL_SECRET;

    if (!correctPassword || !secret) {
      return NextResponse.json({ error: 'Server not configured — set PORTAL_PASSWORD and PORTAL_SECRET env vars.' }, { status: 500 });
    }

    if (!password || password !== correctPassword) {
      // Small delay to slow brute-force attempts
      await new Promise(r => setTimeout(r, 500));
      return NextResponse.json({ error: 'Incorrect password. Try again.' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set('snap_portal_auth', secret, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30, // 30 days
      path:     '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
