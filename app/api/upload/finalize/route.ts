import { NextRequest, NextResponse } from 'next/server';
import { finalizeFilePermissions } from '@/lib/google-drive';

export const runtime = 'nodejs';

// POST /api/upload/finalize
// After client has uploaded the file directly to Google Drive,
// set it to publicly viewable and return the share link.
export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    const link = await finalizeFilePermissions(fileId);
    return NextResponse.json({ data: { link } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/upload/finalize]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
