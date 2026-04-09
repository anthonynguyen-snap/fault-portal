import { google } from "googleapis";
import { Readable } from "stream";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");
  const credentials = typeof raw === "string" ? JSON.parse(raw) : raw;
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

/** Returns the label for the current month, e.g. "April 2026" */
function currentMonthLabel(): string {
  return new Date().toLocaleString("en-AU", { month: "long", year: "numeric" });
}

/** Finds or creates the monthly sub-folder inside the root evidence folder. */
async function getOrCreateMonthFolder(
  drive: ReturnType<typeof google.drive>
): Promise<{ id: string; url: string }> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("Missing GOOGLE_DRIVE_ROOT_FOLDER_ID");

  const label = currentMonthLabel();

  // Check if folder already exists
  const search = await drive.files.list({
    q: `name='${label}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,webViewLink)",
    spaces: "drive",
  });

  if (search.data.files && search.data.files.length > 0) {
    const f = search.data.files[0];
    return { id: f.id!, url: f.webViewLink! };
  }

  // Create a new monthly folder
  const created = await drive.files.create({
    requestBody: {
      name: label,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    },
    fields: "id,webViewLink",
  });

  return { id: created.data.id!, url: created.data.webViewLink! };
}

export interface UploadResult {
  fileUrl: string;
  folderUrl: string;
}

/** Uploads a file buffer to the correct monthly Drive folder. */
export async function uploadToDrive(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
  orderNumber: string
): Promise<UploadResult> {
  const auth  = await getAuth().getClient();
  const drive = google.drive({ version: "v3", auth: auth as never });

  const folder = await getOrCreateMonthFolder(drive);

  const date     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const safeName = `${orderNumber}_${date}_${originalName}`.replace(/[^a-zA-Z0-9._\-]/g, "_");

  const stream = Readable.from(fileBuffer);

  const file = await drive.files.create({
    requestBody: {
      name: safeName,
      parents: [folder.id],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id,webViewLink",
  });

  // Make the file viewable by anyone with the link
  await drive.permissions.create({
    fileId: file.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileUrl:   file.data.webViewLink!,
    folderUrl: folder.url,
  };
}
