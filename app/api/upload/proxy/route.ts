import { NextRequest } from 'next/server';

// Edge runtime: no 4.5 MB body-size limit, streams the file
// body directly to Google Drive without buffering it.
export const runtime = 'edge';

export async function PUT(req: NextRequest) {
  const uploadUrl = req.headers.get('x-upload-url');
  const contentType = req.headers.get('content-type') || 'application/octet-stream';
  const contentLength = req.headers.get('content-length');

  if (!uploadUrl) {
    return new Response(JSON.stringify({ error: 'Missing x-upload-url header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const driveHeaders: Record<string, string> = { 'Content-Type': contentType };
    if (contentLength) driveHeaders['Content-Length'] = contentLength;

    const driveRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: driveHeaders,
      // @ts-ignore – duplex is required for streaming request bodies in some runtimes
      body: req.body,
      duplex: 'half',
    });

    const text = await driveRes.text();

    if (!driveRes.ok) {
      return new Response(
        JSON.stringify({ error: `Drive upload failed: ${driveRes.status}`, detail: text }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Return Drive's JSON response (contains the file id)
    return new Response(text, {
      status: driveRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
