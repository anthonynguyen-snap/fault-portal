import { NextRequest, NextResponse } from 'next/server';
import { createResumableUploadSession } from '@/lib/google-drive';

export const runtime = 'nodejs';

// POST /api/upload/session
// Creates a Google Drive resumable upload session.
// Returns { uploadUrl } — the client PUTs the file directly to this URL,
// so the file never passes through Vercel (no body-size limit).
export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, fileSize, caseId } = await req.json();

    if (!fileName || !fileType || !caseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const uploadUrl = await createResumableUploadSession(
      fileName,
      fileType,
      fileSize ?? 0,
      caseId,
    );

    return NextResponse.json({ uploadUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/upload/session]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
