import { NextRequest, NextResponse } from 'next/server';
import { createResumableUploadSession } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, fileSize, caseId } = await req.json();
    if (!fileName || !fileType || !caseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const uploadUrl = await createResumableUploadSession(
      fileName, fileType, fileSize ?? 0, caseId,
    );

    // Extract just the upload_id from the Location URL.
    // We return only the upload_id (not the full URL) so the proxy can
    // reconstruct the correct URL server-side, avoiding any client-side
    // encoding/decoding issues with the full URL.
    let uploadId: string | null = null;
    try {
      uploadId = new URL(uploadUrl).searchParams.get('upload_id');
    } catch { /* fall through */ }

    if (!uploadId) {
      // Fallback: return the full URL so the old code path still works
      return NextResponse.json({ uploadUrl });
    }

    return NextResponse.json({ uploadId, uploadUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/upload/session]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
