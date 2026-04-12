import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Proxy a single chunk to Google Drive resumable upload.
// Accepts the upload session ID via X-Upload-Id header (short, safe).
// Reconstructs the full Google Drive upload URL server-side to avoid
// any client-side URL encoding/decoding corruption.
export async function PUT(req: NextRequest) {
  const uploadId    = req.headers.get('x-upload-id');
  const contentType = req.headers.get('content-type') || 'application/octet-stream';
  const contentRange = req.headers.get('x-content-range');

  if (!uploadId) {
    return Response.json({ error: 'Missing x-upload-id header' }, { status: 400 });
  }

  // Reconstruct the canonical Drive resumable-upload URL from the session ID.
  // This avoids passing the full URL through client-side code where it could
  // get corrupted by encoding/decoding.
  const driveUploadUrl =
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${uploadId}`;

  try {
    const blob = await req.blob();

    const driveHeaders: Record<string, string> = {
      'Content-Type': contentType,
    };
    if (contentRange) {
      driveHeaders['Content-Range'] = contentRange;
    }

    const driveRes = await fetch(driveUploadUrl, {
      method: 'PUT',
      headers: driveHeaders,
      body: blob,
    });

    const text = await driveRes.text();

    // 308 Resume Incomplete = chunk accepted, more chunks needed
    if (driveRes.status === 308) {
      return Response.json(
        { status: 'incomplete', range: driveRes.headers.get('range') ?? '' },
        { status: 200 },
      );
    }

    if (!driveRes.ok) {
      return Response.json(
        { error: `Drive upload failed (${driveRes.status})`, detail: text },
        { status: 502 },
      );
    }

    // 200 / 201 — upload complete; Google returns file metadata JSON
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* ignore */ }

    return Response.json({ status: 'complete', id: data.id ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
