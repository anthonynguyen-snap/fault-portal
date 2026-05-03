import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { InternalNote } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'Note text is required' }, { status: 400 });

  const supabase = getSupabase();

  // Fetch current notes
  const { data: existing, error: fetchError } = await supabase
    .from('refund_requests')
    .select('internal_notes')
    .eq('id', params.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
  }

  const currentNotes: InternalNote[] = Array.isArray(existing.internal_notes)
    ? existing.internal_notes
    : [];

  const newNote: InternalNote = {
    id:        `note-${Date.now()}`,
    text:      text.trim(),
    author:    session.name,
    createdAt: new Date().toISOString(),
  };

  const updatedNotes = [...currentNotes, newNote];

  const { error: updateError } = await supabase
    .from('refund_requests')
    .update({ internal_notes: updatedNotes })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ data: updatedNotes });
}
