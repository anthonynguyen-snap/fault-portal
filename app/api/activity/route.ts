import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export interface ActivityRow {
  id:          string;
  ts:          string;
  actor:       string;
  action:      string;
  entityType:  string;
  entityId:    string;
  entityLabel: string;
  detail:      Record<string, unknown>;
}

function fromRow(row: Record<string, unknown>): ActivityRow {
  return {
    id:          String(row.id ?? ''),
    ts:          String(row.ts ?? ''),
    actor:       String(row.actor ?? ''),
    action:      String(row.action ?? ''),
    entityType:  String(row.entity_type ?? ''),
    entityId:    String(row.entity_id ?? ''),
    entityLabel: String(row.entity_label ?? ''),
    detail:      (row.detail as Record<string, unknown>) ?? {},
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days       = parseInt(searchParams.get('days') ?? '14', 10);
    const actor      = searchParams.get('actor');
    const entityType = searchParams.get('type');

    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = getSupabase()
      .from('activity_log')
      .select('*')
      .gte('ts', since.toISOString())
      .order('ts', { ascending: false })
      .limit(500);

    if (actor)      query = query.eq('actor', actor);
    if (entityType) query = query.eq('entity_type', entityType);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
