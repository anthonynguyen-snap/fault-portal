import { NextRequest, NextResponse } from 'next/server';
import { uploadChunkToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';

// Receives one 3MB chunk as multipart FormData:
//   sessionUrl  — Google Drive resumable upload URL (text)
//   chunk       — binary file chunk (file field)
//   contentRange — e.g. "bytes 0-3145727/10000000" (text)
//   mimeType    — file MIME type (text)
//
// Node.js runtime so it can: (a) access Google credentials for auth,
// (b) accept up to 4.5MB body (3MB chunk + overhead is safe).
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sessionUrl  = formData.get('sessionUrl')  as string | null;
    const chunkBlob   = formData.get('chunk')        as Blob   | null;
    const contentRange = formData.get('contentRange') as string | null;
    const mimeType    = (formData.get('mimeType')    as string | null) || 'application/octet-stream';

    if (!sessionUrl) return NextResponse.json({ error: 'Missing sessionUrl' }, { status: 400 });
    if (!chunkBlob)  return NextResponse.json({ error: 'Missing chunk'      }, { status: 400 });

    const chunkBuffer = Buffer.from(await chunkBlob.arrayBuffer());
    const result = await uploadChunkToDrive(
      sessionUrl,
      chunkBuffer,
      mimeType,
      contentRange ?? undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/upload/chunk]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
