import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getPerformanceAgentConfig } from '@/lib/performance-agents';

export const runtime = 'nodejs';

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message);
  return String(error);
}

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const agents = await getPerformanceAgentConfig();
    return NextResponse.json({
      agents,
      primaryAgentIds: agents
        .filter(agent => agent.performancePrimary)
        .map(agent => agent.commslayerAgentId),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
