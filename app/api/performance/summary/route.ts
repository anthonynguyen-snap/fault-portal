import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, from, to, periodLabel } = body as {
      data: {
        agents: unknown;
        overview: unknown;
        csat: unknown;
      };
      from: string;
      to: string;
      periodLabel: string;
    };

    // Build a concise summary of the data for the prompt
    const agentsRaw = (data?.agents as any)?.data?.data ?? (data?.agents as any)?.data ?? data?.agents ?? [];
    const overviewRaw = (data?.overview as any)?.data?.data ?? (data?.overview as any)?.metrics?.data ?? data?.overview ?? {};
    const csatRaw = (data?.csat as any)?.data?.data ?? data?.csat ?? {};

    // Summarise agents
    const agentSummaries: string[] = [];
    const PRIMARY_AGENT_IDS = [6525, 6988, 3007]; // Niko, Gabriel, Charles
    const TARGET_REPLIES = 60;
    const TARGET_RESOLVE = 0.30;
    const TARGET_CSAT = 3.0;

    // Work out how many days are in the period so daily rate is accurate
    const periodDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);

    if (Array.isArray(agentsRaw)) {
      for (const agent of agentsRaw) {
        const name    = agent.agent || agent.agent_name || 'Unknown';
        // messages_sent is the total for the period — divide by days for daily rate
        const totalMsgs  = Number(agent.messages_sent ?? 0);
        const dailyRate  = totalMsgs / periodDays;
        // one_touch_tickets is already a percentage (e.g. 15.7)
        const oneTouch   = Number(agent.one_touch_tickets ?? 0);
        const csat       = Number(agent.avg_csat ?? 0);

        const isPrimary = PRIMARY_AGENT_IDS.includes(Number(agent.agent_id ?? agent.id));
        const repliesStatus  = dailyRate >= TARGET_REPLIES
          ? `on target (${dailyRate.toFixed(1)}/day)`
          : `below target (${dailyRate.toFixed(1)}/day vs ${TARGET_REPLIES} target)`;
        const resolveStatus  = oneTouch === 0
          ? 'no data'
          : oneTouch >= TARGET_RESOLVE * 100
            ? `on target (${oneTouch.toFixed(1)}%)`
            : `below target (${oneTouch.toFixed(1)}% vs ${TARGET_RESOLVE * 100}% target)`;
        const csatStatus     = csat === 0
          ? 'no responses'
          : csat >= TARGET_CSAT
            ? `on target (${csat.toFixed(1)})`
            : `below target (${csat.toFixed(1)} vs ${TARGET_CSAT} target)`;

        agentSummaries.push(
          `${name}${isPrimary ? ' (support agent)' : ' (management/other)'}:` +
          ` daily replies ${repliesStatus}, one-touch rate ${resolveStatus}, CSAT ${csatStatus}`
        );
      }
    }

    // Summarise overview
    const overviewMetrics = overviewRaw?.overview ?? overviewRaw ?? {};
    const totalConversations = overviewMetrics.total_conversations ?? overviewMetrics.conversations_count ?? 'unknown';
    const avgFirstResponse = overviewMetrics.avg_first_response_time ?? 'unknown';
    const avgResolution = overviewMetrics.avg_resolution_time ?? 'unknown';

    // Summarise CSAT
    const csatSummary = csatRaw?.summary ?? {};
    const avgCsat = csatSummary.avg_rating ?? csatSummary.average_rating ?? 0;
    const totalCsatResponses = csatSummary.total_count ?? csatSummary.total_responses ?? 0;

    const prompt = `You are a customer support operations manager assistant. Based on the following team performance data for the period ${periodLabel} (${from} to ${to}), write a concise 3-4 sentence management briefing.

KPI Targets: ${TARGET_REPLIES} replies/day, ${Math.round(TARGET_RESOLVE * 100)}% resolve rate, CSAT ≥ ${TARGET_CSAT}.

Team performance:
${agentSummaries.join('\n')}

Overview metrics:
- Total conversations: ${totalConversations}
- Avg first response time: ${typeof avgFirstResponse === 'number' ? `${Math.round(avgFirstResponse / 60)} mins` : avgFirstResponse}
- Avg resolution time: ${typeof avgResolution === 'number' ? `${Math.round(avgResolution / 3600)} hrs` : avgResolution}
- Overall CSAT: ${Number(avgCsat) > 0 ? Number(avgCsat).toFixed(1) : 'N/A'} (${totalCsatResponses} responses)

Instructions:
- Focus on the primary support agents (Niko, Gabriel, Charles) for KPI performance
- Mention any agents performing particularly well or needing attention by name
- Note any overall trends in volume or CSAT
- Be direct and actionable — this is for an internal manager, not a customer
- Do NOT use bullet points; write in flowing prose
- Keep it under 80 words`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const summary = message.content[0]?.type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error('[POST /api/performance/summary]', err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
