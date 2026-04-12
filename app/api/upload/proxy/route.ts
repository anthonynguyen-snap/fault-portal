import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Proxy a single chunk to Google Drive resumable upload.
// Chunks must be <= 3 MB so they stay under Vercel's 4.5 MB body limit.
// The client sends the Google-Drive upload URL in X-Upload-Url and the
// byte range in X-Content-Range (e.g. "bytes 0-3145727/10000000").
export async function PUT(req: NextRequest) {
  const uploadUrl    = req.headers.get('x-upload-url');
  const contentType  = req.headers.get('content-type') || 'application/octet-stream';
  const contentRange = req.headers.get('x-content-range'); // forwarded as Content-Range to Drive

  if (!uploadUrl) {
    return Response.json({ error: 'Missing x-upload-url header' }, { status: 400 });
  }

  try {
    const blob = await req.blob();

    const driveHeaders: Record<string, string> = {
      'Content-Type':   contentType,
      'Content-Length': String(blob.size),
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
        { error: `Drive upload failed (${driveRes.status})`, detail: text },
        { status: 500 },
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
