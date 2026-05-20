import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'snap_session';
const SESSION_TIME_ZONE = 'Australia/Adelaide';

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. ' +
      'Add it to your .env.local and Vercel project settings.'
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  agentId: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  shiftLogId?: string;
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour') % 24,
    minute: value('minute'),
    second: value('second'),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedMidnightUtc(year: number, month: number, day: number, timeZone: string) {
  let utcTime = Date.UTC(year, month, day, 0, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(new Date(utcTime), timeZone);
    utcTime = Date.UTC(year, month, day, 0, 0, 0, 0) - offset;
  }
  return new Date(utcTime);
}

/** Create a JWT and set it as an httpOnly cookie expiring at local Adelaide midnight. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const now = new Date();
  const localNow = getZonedParts(now, SESSION_TIME_ZONE);
  const expiresAt = zonedMidnightUtc(localNow.year, localNow.month - 1, localNow.day + 1, SESSION_TIME_ZONE);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
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
