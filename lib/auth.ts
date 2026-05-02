import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'snap_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-in-production';

function getSecretKey() {
  return new TextEncoder().encode(SESSION_SECRET);
}

export interface SessionPayload {
  agentId: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  shiftLogId?: string;
}

/** Create a JWT and set it as an httpOnly cookie expiring at midnight AEST. */
export async function createSession(payload: SessionPayload): Promise<void> {
  // Expire at midnight AEST (UTC+10) — same as current day end
  const now = new Date();
  // Midnight tonight in local AEST: advance to next midnight UTC+10
  const aestOffset = 10 * 60 * 60 * 1000; // 10 hours in ms
  const aestNow = new Date(now.getTime() + aestOffset);
  const midnightAest = new Date(
    Date.UTC(
      aestNow.getUTCFullYear(),
      aestNow.getUTCMonth(),
      aestNow.getUTCDate() + 1,
      0, 0, 0, 0
    ) - aestOffset
  );

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(midnightAest.getTime() / 1000))
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: midnightAest,
    path: '/',
  });
}

/** Verify and return the session payload, or null if invalid/missing. */
export async function verifySession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Clear the session cookie (logout). */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
