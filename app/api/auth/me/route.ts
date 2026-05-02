import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.agentId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}
