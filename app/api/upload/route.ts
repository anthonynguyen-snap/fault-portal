import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { uploadToDrive } from "@/lib/google-drive";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/mpeg",
  "video/x-msvideo",
]);

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file       = formData.get("file") as File | null;
  const orderNumber = (formData.get("orderNumber") as string) || "UNKNOWN";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type "${file.type}" is not allowed. Upload images or videos only.` },
      { status: 415 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 100 MB." },
      { status: 413 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToDrive(buffer, file.type, file.name, orderNumber);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Drive upload error:", err);
    return NextResponse.json({ error: "Upload to Google Drive failed" }, { status: 500 });
  }
}
