import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RosterAgent } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): RosterAgent {
  return {
    id:        String(row.id ?? ''),
    name:      String(row.name ?? ''),
    colour:    String(row.colour ?? '#6366f1'),
    shiftType: (row.shift_type ?? 'tue-sat') as RosterAgent['shiftType'],
    isAdmin:   Boolean(row.is_admin ?? false),
    active:    Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('roster_agents')
      .select('*')
      .eq('active', true)
      .order('created_at');
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await getSupabase()
      .from('roster_agents')
      .insert({
        name:       body.name,
        colour:     body.colour ?? '#6366f1',
        shift_type: body.shiftType ?? 'tue-sat',
        is_admin:   body.isAdmin ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
