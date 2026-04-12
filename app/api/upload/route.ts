import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToDrive } from '@/lib/google-drive';

export const runtime = 'nodejs'; // Required for file handling

// POST /api/upload — upload evidence file to Google Drive
// Expects multipart/form-data with fields: file, caseId
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file    = formData.get('file') as File | null;
    const caseId  = formData.get('caseId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!caseId) {
      return NextResponse.json({ error: 'No caseId provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/avi',
      'video/mkv',
      'application/pdf',
    ];
    const isVideo = file.type.startsWith('video/') || /\.(mov|mp4|avi|wmv|mkv)$/i.test(file.name);

    if (!allowedTypes.includes(file.type) && !isVideo) {
      return NextResponse.json(
        { error: 'File type not allowed. Please upload images, videos (MP4, MOV, AVI), or PDFs.' },
        { status: 400 }
      );
    }

    // Max 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Google Drive
    const driveLink = await uploadFileToDrive(
      buffer,
      file.name,
      file.type,
      caseId
    );

    return NextResponse.json({
      data: { link: driveLink, fileName: file.name },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error('[POST /api/upload] FULL ERROR:', msg);
    console.error('[POST /api/upload] STACK:', stack);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.', detail: msg },
      { status: 500 }
    );
  }
}
