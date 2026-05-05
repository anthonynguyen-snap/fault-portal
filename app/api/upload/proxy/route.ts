import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Proxy a single chunk to Google Drive resumable upload.
// The full Google Drive upload URL is passed as a base64-encoded header
// (X-Upload-B64) so no URL encoding/decoding can corrupt it.
export async function PUT(req: NextRequest) {
  const uploadB64   = req.headers.get('x-upload-b64');
  const contentType = req.headers.get('content-type') || 'application/octet-stream';
  const contentRange = req.headers.get('x-content-range');

  if (!uploadB64) {
    return Response.json({ error: 'Missing X-Upload-B64 header' }, { status: 400 });
  }

  let uploadUrl: string;
  try {
    uploadUrl = atob(uploadB64);
  } catch {
    return Response.json({ error: 'Could not decode X-Upload-B64 header' }, { status: 400 });
  }

  try {
    const blob = await req.blob();

    const driveHeaders: Record<string, string> = {
      'Content-Type': contentType,
    };
    if (contentRange) {
      driveHeaders['Content-Range'] = contentRange;
    }

    const driveRes = await fetch(uploadUrl, {
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
        { error: `Drive upload failed (${driveRes.status})`, detail: text, urlUsed: uploadUrl.slice(0, 150) },
        { status: 502 },
      );
    }

    // 200 / 201 — upload complete
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* ignore */ }

    return Response.json({ status: 'complete', id: data.id ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
