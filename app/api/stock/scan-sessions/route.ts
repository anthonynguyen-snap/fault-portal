import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

type ScanSessionPayload = {
  id: string;
  name: string;
  savedAt: string;
  purpose: 'stocktake' | 'send-3pl';
  scanUser: string;
  scanLocation: string;
  events: unknown[];
};

function normaliseSession(input: Partial<ScanSessionPayload>): ScanSessionPayload {
  return {
    id: String(input.id || `${Date.now()}`),
    name: String(input.name || 'Saved stocktake session'),
    savedAt: String(input.savedAt || new Date().toISOString()),
    purpose: input.purpose === 'send-3pl' ? 'send-3pl' : 'stocktake',
    scanUser: String(input.scanUser || ''),
    scanLocation: String(input.scanLocation || ''),
    events: Array.isArray(input.events) ? input.events : [],
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('activity_log')
      .select('action, entity_id, detail, ts')
      .eq('entity_type', 'stocktake_session')
      .order('ts', { ascending: false })
      .limit(200);
    if (error) throw error;

    const seen = new Set<string>();
    const deleted = new Set<string>();
    const sessions: ScanSessionPayload[] = [];

    for (const row of data ?? []) {
      const id = String(row.entity_id || '');
      if (!id || seen.has(id) || deleted.has(id)) continue;
      if (row.action === 'stocktake_session_deleted') {
        deleted.add(id);
        seen.add(id);
        continue;
      }
      if (row.action !== 'stocktake_session_saved') continue;
      const detail = (row.detail ?? {}) as Partial<ScanSessionPayload>;
      sessions.push(normaliseSession({ ...detail, id, savedAt: String(detail.savedAt || row.ts || new Date().toISOString()) }));
      seen.add(id);
    }

    return NextResponse.json({ data: sessions });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = normaliseSession(await req.json());
    if (!session.events.length) {
      return NextResponse.json({ error: 'Session has no scan counts' }, { status: 400 });
    }

    const { error } = await getSupabase().from('activity_log').insert({
      actor: session.scanUser || 'Stocktake',
      action: 'stocktake_session_saved',
      entity_type: 'stocktake_session',
      entity_id: session.id,
      entity_label: session.name,
      detail: session,
    });
    if (error) throw error;
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Session id is required' }, { status: 400 });
    const { error } = await getSupabase().from('activity_log').insert({
      actor: 'Stocktake',
      action: 'stocktake_session_deleted',
      entity_type: 'stocktake_session',
      entity_id: id,
      entity_label: 'Deleted stocktake session',
      detail: { id },
    });
    if (error) throw error;
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
