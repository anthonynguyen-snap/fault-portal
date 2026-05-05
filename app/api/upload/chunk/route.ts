import { NextRequest, NextResponse } from 'next/server';
import { uploadChunkToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';

// Accepts JSON body:
//   sessionUrl   — Google Drive resumable upload URL
//   chunkBase64  — base64-encoded chunk bytes
//   contentRange — e.g. "bytes 0-1048575/5000000"
//   mimeType     — file MIME type
//
// Using JSON + base64 (not multipart FormData) avoids binary encoding
// issues and Vercel infrastructure connection-resets on large bodies.
export async function POST(req: NextRequest) {
  try {
    const { sessionUrl, chunkBase64, contentRange, mimeType } = await req.json();

    if (!sessionUrl)   return NextResponse.json({ error: 'Missing sessionUrl'  }, { status: 400 });
    if (!chunkBase64)  return NextResponse.json({ error: 'Missing chunkBase64' }, { status: 400 });

    // Decode base64 → Buffer
    const chunkBuffer = Buffer.from(chunkBase64, 'base64');
    const mime = mimeType || 'application/octet-stream';

    const result = await uploadChunkToDrive(
      sessionUrl,
      chunkBuffer,
      mime,
      contentRange ?? undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[POST /api/upload/chunk]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
