// =========================================================
// GOOGLE DRIVE INTEGRATION
// Handles evidence file uploads for fault cases.
// =========================================================

import { google } from 'googleapis';
import { Readable } from 'stream';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

/**
 * Upload a file buffer to Google Drive.
 * Files are organised: Root Folder → Case ID sub-folder → file.
 *
 * Returns a shareable view link.
 */
export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  caseId: string
): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Get or create a sub-folder named after the case ID
  const caseFolderId = await getOrCreateFolder(drive, caseId, rootFolderId);

  // Upload the file
  const fileRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [caseFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const fileId = fileRes.data.id!;

  // Make the file publicly viewable (read-only)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  return fileRes.data.webViewLink
    || `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Find or create a folder inside a parent folder.
 * This prevents duplicate folders being created on each upload.
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentId: string
): Promise<string> {
  // Search for existing folder
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = [
    `name='${escapedName}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `'${parentId}' in parents`,
    `trashed=false`,
  ].join(' and ');

  const res = await drive.files.list({
    q: query,
    fields: 'files(id)',
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create new folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  return folder.data.id!;
}

/**
 * Get a list of files in a case's Drive folder.
 * Used to show evidence previews on the case detail page.
 */
export async function getFilesForCase(caseId: string): Promise<
  { id: string; name: string; webViewLink: string; mimeType: string }[]
> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Find the case folder
  const escapedName = caseId.replace(/'/g, "\\'");
  const query = [
    `name='${escapedName}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `'${rootFolderId}' in parents`,
    `trashed=false`,
  ].join(' and ');

  const folderRes = await drive.files.list({ q: query, fields: 'files(id)', pageSize: 1, includeItemsFromAllDrives: true, supportsAllDrives: true });
  if (!folderRes.data.files || folderRes.data.files.length === 0) return [];

  const folderId = folderRes.data.files[0].id!;

  // List files inside that folder
  const filesRes = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink, mimeType)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return (filesRes.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    webViewLink: f.webViewLink!,
    mimeType: f.mimeType!,
  }));
}

/**
 * Initiate a Google Drive resumable upload session (server-side).
 * Returns the upload URL the client can PUT the file body to directly —
 * the file data never passes through Vercel.
 */
export async function createResumableUploadSession(
  fileName: string,
  mimeType: string,
  fileSize: number,
  caseId: string,
): Promise<string> {
  const auth = getAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = await auth.getClient() as any;
  const tokenRes = await client.getAccessToken();
  const accessToken: string = tokenRes.token;

  const drive = google.drive({ version: 'v3', auth });
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const caseFolderId = await getOrCreateFolder(drive, caseId, rootFolderId);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({ name: fileName, parents: [caseFolderId] }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload session failed: ${res.status} ${text}`);
  }

  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive did not return an upload URL');
  return uploadUrl;
}

/**
 * After a direct browser-to-Drive upload completes, set the file
 * to publicly viewable and return the share link.
 */
export async function finalizeFilePermissions(fileId: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getAuth() });

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  const file = await drive.files.get({
    fileId,
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });

  return file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Upload one chunk of a resumable upload directly from the server.
 * Includes the Authorization header so Google accepts the request.
 */
export async function uploadChunkToDrive(
  uploadUrl: string,
  chunkBuffer: Buffer,
  mimeType: string,
  contentRange?: string,
): Promise<{ status: 'incomplete' | 'complete'; id: string | null; range: string }> {
  const auth = getAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = await auth.getClient() as any;
  const tokenRes = await client.getAccessToken();
  const accessToken: string = tokenRes.token;

  const headers: Record<string, string> = {
    'Content-Type': mimeType || 'application/octet-stream',
    'Authorization': `Bearer ${accessToken}`,
  };
  if (contentRange) headers['Content-Range'] = contentRange;

  const driveRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: chunkBuffer as any,
  });

  const text = await driveRes.text();

  // 308 Resume Incomplete = chunk accepted, more needed
  if (driveRes.status === 308) {
    return { status: 'incomplete', id: null, range: driveRes.headers.get('range') ?? '' };
  }

  if (!driveRes.ok) {
    throw new Error(`Drive chunk upload failed (${driveRes.status}): ${text.slice(0, 400)}`);
  }

  let data: { id?: string } = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }
  return { status: 'complete', id: data.id ?? null, range: '' };
}

