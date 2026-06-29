/**
 * stock-sheets.ts
 *
 * Reads/writes the shared stock Google Sheet (owned by stock-portal).
 * Uses separate env vars (STOCK_*) so they don't clash with the fault
 * portal's own GOOGLE_* credentials for the Fault Log sheet.
 */

import { google } from 'googleapis';
import type { StockItem } from '@/types';

export const runtime = 'nodejs';

const SCOPES     = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_NAME = 'Stock';
const LOG_NAME   = 'Log';

const COL = {
  SKU:          0,
  NAME:         1,
  CATEGORY:     2,
  IMAGE_URL:    3,
  QUANTITY:     4,
  MIN_STOCK:    5,
  DISCONTINUED: 6,  // column G – not used by stock-portal, managed here
} as const;

// ─── auth ────────────────────────────────────────────────────────────────────

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.STOCK_SERVICE_ACCOUNT_EMAIL,
      private_key:  (process.env.STOCK_PRIVATE_KEY ?? '')
        .replace(/^"|"$/g, '')
        .replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

const SHEET_ID = () => process.env.STOCK_SHEET_ID!;

// ─── internal row type ────────────────────────────────────────────────────────

interface SheetRow {
  sku:          string;
  name:         string;
  category:     string;
  imageUrl:     string;
  quantity:     number;
  minStock:     number;
  discontinued: boolean;
  rowIndex:     number;   // 1-based row in the sheet (row 1 = header)
}

function parseRow(row: string[], i: number): SheetRow {
  return {
    sku:          row[COL.SKU]          ?? '',
    name:         row[COL.NAME]         ?? '',
    category:     row[COL.CATEGORY]     ?? 'Uncategorised',
    imageUrl:     row[COL.IMAGE_URL]    ?? '',
    quantity:     parseInt(row[COL.QUANTITY]  ?? '0', 10),
    minStock:     parseInt(row[COL.MIN_STOCK] ?? '0', 10),
    discontinued: (row[COL.DISCONTINUED] ?? '').toUpperCase() === 'TRUE',
    rowIndex:     i + 2,  // data starts at row 2
  };
}

/** Map a sheet row → fault portal's StockItem (id = sku) */
function toStockItem(r: SheetRow): StockItem {
  return {
    id:                r.sku,   // ← KEY: id is the SKU string
    name:              r.name,
    sku:               r.sku,
    quantity:          r.quantity,
    lowStockThreshold: r.minStock,
    discontinued:      r.discontinued,
    createdAt:         '',      // not stored in the sheet
    category:          r.category,
    imageUrl:          r.imageUrl,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fetchAllRows(): Promise<SheetRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${SHEET_NAME}!A2:G`,   // A–G to pick up discontinued column
  });
  return (res.data.values ?? [])
    .map((row, i) => parseRow(row as string[], i))
    .filter((r) => r.sku !== '');
}

async function getSheetGid(): Promise<number> {
  const sheets = getSheets();
  const meta   = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() });
  const sheet  = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  return sheet?.properties?.sheetId ?? 0;
}

async function ensureLogSheet(): Promise<void> {
  const sheets = getSheets();
  const meta   = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === LOG_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID(),
      requestBody:   { requests: [{ addSheet: { properties: { title: LOG_NAME } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId:   SHEET_ID(),
      range:           `${LOG_NAME}!A1:F1`,
      valueInputOption:'USER_ENTERED',
      requestBody:     { values: [['Timestamp', 'SKU', 'Name', 'Action', 'Quantity', 'Note']] },
    });
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function getAllStockItems(): Promise<StockItem[]> {
  const rows = await fetchAllRows();
  return rows.map(toStockItem);
}

export async function addStockItem(opts: {
  name:              string;
  sku:               string;
  lowStockThreshold: number;
  category?:         string;
  imageUrl?:         string;
}): Promise<StockItem> {
  const sheets = getSheets();
  const row = [
    opts.sku,
    opts.name,
    opts.category ?? 'Uncategorised',
    opts.imageUrl ?? '',
    0,                          // initial quantity
    opts.lowStockThreshold,
    'FALSE',                    // discontinued = false
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId:   SHEET_ID(),
    range:           `${SHEET_NAME}!A:G`,
    valueInputOption:'USER_ENTERED',
    requestBody:     { values: [row] },
  });
  return {
    id:                opts.sku,
    name:              opts.name,
    sku:               opts.sku,
    quantity:          0,
    lowStockThreshold: opts.lowStockThreshold,
    discontinued:      false,
    createdAt:         new Date().toISOString(),
    category:          opts.category ?? 'Uncategorised',
    imageUrl:          opts.imageUrl ?? '',
  };
}

export async function updateStockItem(
  sku: string,
  updates: Partial<{
    name:              string;
    newSku:            string;
    lowStockThreshold: number;
    category:          string;
    imageUrl:          string;
    discontinued:      boolean;
  }>,
): Promise<StockItem> {
  const sheets = getSheets();
  const rows   = await fetchAllRows();
  const item   = rows.find((r) => r.sku === sku);
  if (!item) throw new Error(`SKU not found: ${sku}`);

  const merged: SheetRow = {
    ...item,
    name:         updates.name              ?? item.name,
    sku:          updates.newSku            ?? item.sku,
    minStock:     updates.lowStockThreshold ?? item.minStock,
    category:     updates.category          ?? item.category,
    imageUrl:     updates.imageUrl          ?? item.imageUrl,
    discontinued: updates.discontinued      ?? item.discontinued,
  };

  await sheets.spreadsheets.values.update({
    spreadsheetId:   SHEET_ID(),
    range:           `${SHEET_NAME}!A${item.rowIndex}:G${item.rowIndex}`,
    valueInputOption:'USER_ENTERED',
    requestBody: {
      values: [[
        merged.sku,
        merged.name,
        merged.category,
        merged.imageUrl,
        merged.quantity,
        merged.minStock,
        merged.discontinued ? 'TRUE' : 'FALSE',
      ]],
    },
  });
  return toStockItem(merged);
}

export async function deleteStockItem(sku: string): Promise<void> {
  const rows   = await fetchAllRows();
  const item   = rows.find((r) => r.sku === sku);
  if (!item) throw new Error(`SKU not found: ${sku}`);

  const sheetGid = await getSheetGid();
  const sheets   = getSheets();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId:    sheetGid,
            dimension:  'ROWS',
            startIndex: item.rowIndex - 1,
            endIndex:   item.rowIndex,
          },
        },
      }],
    },
  });
}

export async function adjustStockQuantity(
  sku:   string,
  delta: number,
  note:  string = '',
): Promise<{ newQuantity: number; itemName: string }> {
  const sheets = getSheets();
  const rows   = await fetchAllRows();
  const item   = rows.find((r) => r.sku === sku);
  if (!item) throw new Error(`SKU not found: ${sku}`);

  const newQty = Math.max(0, item.quantity + delta);

  await sheets.spreadsheets.values.update({
    spreadsheetId:   SHEET_ID(),
    range:           `${SHEET_NAME}!E${item.rowIndex}`,
    valueInputOption:'USER_ENTERED',
    requestBody:     { values: [[newQty]] },
  });

  await ensureLogSheet();
  await sheets.spreadsheets.values.append({
    spreadsheetId:   SHEET_ID(),
    range:           `${LOG_NAME}!A:F`,
    valueInputOption:'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        sku,
        item.name,
        delta >= 0 ? 'IN' : 'OUT',
        Math.abs(delta),
        note,
      ]],
    },
  });

  return { newQuantity: newQty, itemName: item.name };
}

export interface StockDeductionPlanItem {
  sku: string;
  itemName: string;
  rowIndex: number;
  quantityBefore: number;
  quantityAfter: number;
  quantityDeducted: number;
}

export interface StockDeductionPlan {
  items: StockDeductionPlanItem[];
}

/** Validate a multi-SKU dispatch without changing the sheet. */
export async function planStockDeductions(
  deductions: Array<{ sku: string; quantity: number }>,
): Promise<StockDeductionPlan> {
  const combined = new Map<string, number>();
  for (const deduction of deductions) {
    const sku = deduction.sku.trim();
    const quantity = Math.trunc(Number(deduction.quantity));
    if (!sku) throw new Error('Every storeroom item must have a SKU');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Dispatch quantity must be greater than zero for ${sku}`);
    }
    combined.set(sku, (combined.get(sku) ?? 0) + quantity);
  }

  const rows = await fetchAllRows();
  const items = Array.from(combined.entries()).map(([sku, quantity]) => {
    const row = rows.find(candidate => candidate.sku === sku);
    if (!row) throw new Error(`SKU not found in Stock Room: ${sku}`);
    if (row.quantity < quantity) {
      throw new Error(`${row.name} (${sku}) only has ${row.quantity} in stock; ${quantity} requested`);
    }
    return {
      sku,
      itemName: row.name,
      rowIndex: row.rowIndex,
      quantityBefore: row.quantity,
      quantityAfter: row.quantity - quantity,
      quantityDeducted: quantity,
    };
  });

  return { items };
}

async function writePlannedQuantities(
  plan: StockDeductionPlan,
  direction: 'apply' | 'restore',
): Promise<void> {
  if (!plan.items.length) return;
  const sheets = getSheets();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: plan.items.map(item => ({
        range: `${SHEET_NAME}!E${item.rowIndex}`,
        values: [[direction === 'apply' ? item.quantityAfter : item.quantityBefore]],
      })),
    },
  });
}

/** Apply every quantity in one Google Sheets request. */
export async function applyStockDeductionPlan(plan: StockDeductionPlan, note: string): Promise<void> {
  await writePlannedQuantities(plan, 'apply');
  try {
    await ensureLogSheet();
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: `${LOG_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: plan.items.map(item => [
          new Date().toISOString(), item.sku, item.itemName, 'OUT', item.quantityDeducted, note,
        ]),
      },
    });
  } catch (error) {
    console.error('[stock-sheets] quantities updated but dispatch log append failed', error);
  }
}

/** Compensating write used if Supabase cannot finalize a sheet-backed dispatch. */
export async function restoreStockDeductionPlan(plan: StockDeductionPlan): Promise<void> {
  await writePlannedQuantities(plan, 'restore');
}
