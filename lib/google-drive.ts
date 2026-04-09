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
    scopes: ['https://www.googleapis.com/auth/drive.file'],
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
  });

  const fileId = fileRes.data.id!;

  // Make the file publicly viewable (read-only)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
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

  const folderRes = await drive.files.list({ q: query, fields: 'files(id)', pageSize: 1 });
  if (!folderRes.data.files || folderRes.data.files.length === 0) return [];

  const folderId = folderRes.data.files[0].id!;

  // List files inside that folder
  const filesRes = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink, mimeType)',
  });

  return (filesRes.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    webViewLink: f.webViewLink!,
    mimeType: f.mimeType!,
  }));
}
