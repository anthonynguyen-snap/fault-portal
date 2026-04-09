import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import {
  appendFaultRow,
  getAllFaults,
  ensureSheetHeader,
} from "@/lib/google-sheets";
import type { FaultEntry } from "@/lib/types";

// ── GET /api/faults ─────────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const faults = await getAllFaults();
    // Return newest first
    return NextResponse.json(faults.reverse());
  } catch (err) {
    console.error("Sheets read error:", err);
    return NextResponse.json({ error: "Failed to read faults" }, { status: 500 });
  }
}

// ── POST /api/faults ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: Partial<FaultEntry>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Basic validation
  const required = ["faultDate", "orderNumber", "customerName", "productName", "manufacturer", "faultType", "staffMember"] as const;
  for (const field of required) {
    if (!body[field]?.trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const now = new Date();
  const fault: FaultEntry = {
    id:             `FLT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    submittedAt:    now.toISOString(),
    faultDate:      body.faultDate!.trim(),
    orderNumber:    body.orderNumber!.trim().toUpperCase(),
    customerName:   body.customerName!.trim(),
    productName:    body.productName!.trim(),
    manufacturer:   body.manufacturer!.trim(),
    faultType:      body.faultType!.trim(),
    description:    (body.description || "").trim(),
    internalCost:   (body.internalCost || "").trim(),
    staffMember:    body.staffMember!.trim(),
    status:         "Open",
    evidenceUrls:   Array.isArray(body.evidenceUrls) ? body.evidenceUrls : [],
    driveFolderUrl: body.driveFolderUrl || "",
  };

  try {
    await ensureSheetHeader();
    await appendFaultRow(fault);
    return NextResponse.json({ success: true, id: fault.id }, { status: 201 });
  } catch (err) {
    console.error("Sheets write error:", err);
    return NextResponse.json({ error: "Failed to save fault" }, { status: 500 });
  }
}

// ── PATCH /api/faults ────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { faultId, status } = await req.json();
  if (!faultId || !status) {
    return NextResponse.json({ error: "Missing faultId or status" }, { status: 400 });
  }

  try {
    const { updateFaultStatus } = await import("@/lib/google-sheets");
    await updateFaultStatus(faultId, status);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Status update error:", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
