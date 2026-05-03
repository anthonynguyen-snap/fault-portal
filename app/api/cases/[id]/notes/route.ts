import { NextRequest, NextResponse } from 'next/server';
import { getCaseById, updateCase } from '@/lib/google-sheets';
import { verifySession } from '@/lib/auth';
import { InternalNote } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'Note text is required' }, { status: 400 });

  const existing = await getCaseById(id);
  if (!existing) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const newNote: InternalNote = {
    id:        `note-${Date.now()}`,
    text:      text.trim(),
    author:    session.name,
    createdAt: new Date().toISOString(),
  };

  const updated = await updateCase(id, {
    internalNotes: [...(existing.internalNotes || []), newNote],
  });

  return NextResponse.json({ data: updated.internalNotes });
}
