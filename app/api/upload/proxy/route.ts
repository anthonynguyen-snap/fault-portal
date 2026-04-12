import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Proxy the file upload to Google Drive.
// Using req.blob() is more reliable in Vercel Edge than streaming with duplex:'half'.
export async function PUT(req: NextRequest) {
  const uploadUrl = req.headers.get('x-upload-url');
  const contentType = req.headers.get('content-type') || 'application/octet-stream';

  if (!uploadUrl) {
    return Response.json({ error: 'Missing x-upload-url header' }, { status: 400 });
  }

  try {
    // Buffer the entire body — Edge functions support up to 128MB
    const blob = await req.blob();

    const driveRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
      },
      body: blob,
    });

    const text = await driveRes.text();

    if (!driveRes.ok) {
      return Response.json(
        { error: `Drive upload failed (${driveRes.status})`, detail: text },
        { status: 500 },
      );
    }

    return new Response(text, {
      status: driveRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
