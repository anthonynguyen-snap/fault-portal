import { google } from "googleapis";
import type { FaultEntry } from "./types";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");
  const credentials = typeof raw === "string" ? JSON.parse(raw) : raw;
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

const SHEET_ID  = () => process.env.GOOGLE_SHEET_ID!;
const SHEET_TAB = () => process.env.GOOGLE_SHEET_TAB || "Fault Log";

/** Ensures the header row exists. Call once on first run. */
export async function ensureSheetHeader() {
  const auth   = await getAuth().getClient();
  const sheets = google.sheets({ version: "v4", auth: auth as never });

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${SHEET_TAB()}!A1:N1`,
  });

  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID(),
      range: `${SHEET_TAB()}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "Fault ID", "Submitted At", "Fault Date", "Order Number",
          "Customer Name", "Product Name", "Manufacturer", "Fault Type",
          "Description", "Internal Cost ($)", "Staff Member", "Status",
          "Evidence URLs", "Drive Folder URL",
        ]],
      },
    });
  }
}

/** Appends a new fault row to the sheet. */
export async function appendFaultRow(fault: FaultEntry): Promise<void> {
  const auth   = await getAuth().getClient();
  const sheets = google.sheets({ version: "v4", auth: auth as never });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: `${SHEET_TAB()}!A:N`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        fault.id,
        fault.submittedAt,
        fault.faultDate,
        fault.orderNumber,
        fault.customerName,
        fault.productName,
        fault.manufacturer,
        fault.faultType,
        fault.description,
        fault.internalCost || "",
        fault.staffMember,
        fault.status,
        fault.evidenceUrls.join(", "),
        fault.driveFolderUrl,
      ]],
    },
  });
}

/** Reads all fault rows from the sheet. */
export async function getAllFaults(): Promise<FaultEntry[]> {
  const auth   = await getAuth().getClient();
  const sheets = google.sheets({ version: "v4", auth: auth as never });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${SHEET_TAB()}!A2:N`,
  });

  const rows = res.data.values ?? [];

  return rows
    .filter((r) => r[0]) // skip empty rows
    .map((r) => ({
      id:            r[0]  ?? "",
      submittedAt:   r[1]  ?? "",
      faultDate:     r[2]  ?? "",
      orderNumber:   r[3]  ?? "",
      customerName:  r[4]  ?? "",
      productName:   r[5]  ?? "",
      manufacturer:  r[6]  ?? "",
      faultType:     r[7]  ?? "",
      description:   r[8]  ?? "",
      internalCost:  r[9]  ?? "",
      staffMember:   r[10] ?? "",
      status:        r[11] ?? "Open",
      evidenceUrls:  r[12] ? r[12].split(", ").filter(Boolean) : [],
      driveFolderUrl:r[13] ?? "",
    }));
}

/** Updates the status of a specific fault by its row index. */
export async function updateFaultStatus(faultId: string, newStatus: string): Promise<void> {
  const faults = await getAllFaults();
  const rowIndex = faults.findIndex((f) => f.id === faultId);
  if (rowIndex === -1) throw new Error(`Fault ${faultId} not found`);

  const auth   = await getAuth().getClient();
  const sheets = google.sheets({ version: "v4", auth: auth as never });

  // +2 because row 1 is header, and array is 0-indexed
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `${SHEET_TAB()}!L${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[newStatus]] },
  });
}
