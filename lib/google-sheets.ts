// =========================================================
// GOOGLE SHEETS INTEGRATION
// All database reads and writes go through this file.
// =========================================================

import { google } from 'googleapis';
import {
  FaultCase,
  Product,
  Manufacturer,
  FaultType,
  Claim,
  ClaimStatus,
} from '@/types';

// --- Auth Setup ---

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      // Replace literal \n with real newlines (required for Vercel env vars)
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// =========================================================
// FAULT CASES
// =========================================================

const CASES_RANGE = 'Cases!A2:S';
const CASES_COLUMNS = 'Cases!A:S';

function rowToCase(row: string[]): FaultCase {
  let internalNotes: FaultCase['internalNotes'] = [];
  try {
    if (row[14]) internalNotes = JSON.parse(row[14]);
  } catch { /* ignore malformed JSON */ }
  return {
    id:                 row[0]  || '',
    date:               row[1]  || '',
    orderNumber:        row[2]  || '',
    customerName:       row[3]  || '',
    product:            row[4]  || '',
    manufacturerName:   row[5]  || '',
    manufacturerNumber: row[6]  || '',
    faultType:          row[7]  || '',
    faultNotes:         row[8]  || '',
    evidenceLink:       row[9]  || '',
    unitCostUSD:        parseFloat(row[10]) || 0,
    claimStatus:        (row[11] as ClaimStatus) || 'Unsubmitted',
    submittedBy:        row[12] || '',
    createdAt:          row[13] || '',
    internalNotes,
    commslayerChatLink: row[15] || '',
    faultSubtype:       row[16] || '',
    taxonomyStatus:     (row[17] as FaultCase['taxonomyStatus']) || undefined,
    originalFaultType:  row[18] || '',
  };
}

function caseToRow(c: FaultCase): string[] {
  return [
    c.id,
    c.date,
    c.orderNumber,
    c.customerName,
    c.product,
    c.manufacturerName,
    c.manufacturerNumber,
    c.faultType,
    c.faultNotes,
    c.evidenceLink,
    String(c.unitCostUSD),
    c.claimStatus,
    c.submittedBy,
    c.createdAt,
    JSON.stringify(c.internalNotes || []),
    c.commslayerChatLink || '',
    c.faultSubtype || '',
    c.taxonomyStatus || '',
    c.originalFaultType || '',
  ];
}

async function ensureCaseHeaders(): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Cases!P1:S1',
    valueInputOption: 'RAW',
    requestBody: { values: [['Commslayer Chat Link', 'Fault Subtype', 'Taxonomy Status', 'Original Fault Type']] },
  });
}

export async function getCases(): Promise<FaultCase[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: CASES_RANGE,
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0]).map(rowToCase);
}

export async function getCaseById(id: string): Promise<FaultCase | null> {
  const cases = await getCases();
  return cases.find(c => c.id === id) ?? null;
}

export async function createCase(
  data: Omit<FaultCase, 'id' | 'createdAt'>
): Promise<FaultCase> {
  const sheets = getSheets();
  const newCase: FaultCase = {
    ...data,
    taxonomyStatus: data.taxonomyStatus || 'Current taxonomy',
    id: `CASE-${Date.now()}`,
    claimStatus: data.claimStatus || 'Unsubmitted',
    createdAt: new Date().toISOString(),
  };

  await ensureCaseHeaders();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: CASES_COLUMNS,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [caseToRow(newCase)] },
  });

  return newCase;
}

export async function updateCase(
  id: string,
  updates: Partial<FaultCase>
): Promise<FaultCase> {
  const sheets = getSheets();
  const allCases = await getCases();
  const idx = allCases.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Case ${id} not found`);

  const updated: FaultCase = { ...allCases[idx], ...updates };
  const sheetRow = idx + 2; // +1 header, +1 for 1-based index

  await ensureCaseHeaders();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Cases!A${sheetRow}:S${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [caseToRow(updated)] },
  });

  return updated;
}

// =========================================================
// PRODUCTS
// =========================================================

type ProductSheetLayout = 'legacy' | 'structured';
type ProductSheetInfo = {
  layout: ProductSheetLayout;
  headers: string[];
  columns: Partial<Record<'id' | 'name' | 'manufacturerName' | 'unitCostUSD' | 'manufacturerNumbers' | 'claimable' | 'category' | 'subcategory', number>>;
};
type ProductSaveResult = {
  product: Product;
  sheetRow: number;
  writeRange: string;
  layout: ProductSheetLayout;
};

function parseSheetMoney(value: string | undefined): number {
  return parseFloat(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getProductColumnMap(headers: string[], layout: ProductSheetLayout): ProductSheetInfo['columns'] {
  const columns: ProductSheetInfo['columns'] = {};
  headers.forEach((header, index) => {
    switch (normaliseHeader(header)) {
      case 'id':
      case 'productid':
        columns.id = index;
        break;
      case 'product':
      case 'productname':
      case 'name':
        columns.name = index;
        break;
      case 'manufacturer':
      case 'manufacturername':
        columns.manufacturerName = index;
        break;
      case 'unitcost':
      case 'unitcostusd':
      case 'cost':
        columns.unitCostUSD = index;
        break;
      case 'manufacturernumber':
      case 'manufacturernumbers':
      case 'manufacturerpartnumber':
      case 'manufacturerpartnumbers':
        columns.manufacturerNumbers = index;
        break;
      case 'claimable':
      case 'claimstatus':
        columns.claimable = index;
        break;
      case 'category':
        columns.category = index;
        break;
      case 'subcategory':
      case 'subcat':
        columns.subcategory = index;
        break;
    }
  });

  if (layout === 'legacy') {
    return {
      name: columns.name ?? 0,
      unitCostUSD: columns.unitCostUSD ?? 1,
      manufacturerName: columns.manufacturerName ?? 2,
      manufacturerNumbers: columns.manufacturerNumbers,
      claimable: columns.claimable,
      category: columns.category,
      subcategory: columns.subcategory,
    };
  }

  return {
    id: columns.id ?? 0,
    name: columns.name ?? 1,
    manufacturerName: columns.manufacturerName ?? 2,
    unitCostUSD: columns.unitCostUSD ?? 3,
    manufacturerNumbers: columns.manufacturerNumbers ?? 4,
    claimable: columns.claimable ?? 5,
    category: columns.category,
    subcategory: columns.subcategory,
  };
}

async function getProductSheetInfo(): Promise<ProductSheetInfo> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Products!A1:Z1',
  });
  const headers = (res.data.values?.[0] ?? []).map(h => String(h).trim());
  const layout = normaliseHeader(headers[0] ?? '') === 'product' ? 'legacy' : 'structured';
  return { layout, headers, columns: getProductColumnMap(headers, layout) };
}

function productMatches(product: Product, candidate: Pick<Product, 'name' | 'manufacturerName' | 'unitCostUSD'>): boolean {
  return (
    product.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() &&
    product.manufacturerName.trim().toLowerCase() === candidate.manufacturerName.trim().toLowerCase() &&
    Math.abs(product.unitCostUSD - candidate.unitCostUSD) < 0.001
  );
}

function legacyProductId(sheetRow: number): string {
  return `products-row-${sheetRow}`;
}

function readCell(row: string[], index: number | undefined): string {
  return index === undefined ? '' : (row[index] || '');
}

function writeCell(row: string[], index: number | undefined, value: string): void {
  if (index === undefined) return;
  while (row.length <= index) row.push('');
  row[index] = value;
}

function productToSheetRow(product: Product, info: ProductSheetInfo, baseRow: string[] = []): string[] {
  const row = [...baseRow];
  const { columns } = info;
  if (info.layout !== 'legacy') writeCell(row, columns.id, product.id);
  writeCell(row, columns.name, product.name);
  writeCell(row, columns.manufacturerName, product.manufacturerName);
  writeCell(row, columns.unitCostUSD, String(product.unitCostUSD));
  writeCell(row, columns.manufacturerNumbers, product.manufacturerNumbers.join(', '));
  writeCell(row, columns.claimable, product.claimable === false ? 'FALSE' : 'TRUE');
  writeCell(row, columns.category, product.category || '');
  writeCell(row, columns.subcategory, product.subcategory || '');

  const minWidth = Math.max(
    info.headers.length,
    ...Object.values(columns).filter((v): v is number => v !== undefined).map(index => index + 1),
  );
  while (row.length < minWidth) row.push('');
  return row;
}

function rowToProduct(row: string[], info: ProductSheetInfo, sheetRow: number): Product {
  const { layout, columns } = info;
  const manufacturerNumbers = readCell(row, columns.manufacturerNumbers)
    ? readCell(row, columns.manufacturerNumbers).split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const claimableValue = readCell(row, columns.claimable);

  if (layout === 'legacy') {
    return {
      id:                  legacyProductId(sheetRow),
      name:                readCell(row, columns.name),
      unitCostUSD:         parseSheetMoney(readCell(row, columns.unitCostUSD)),
      manufacturerName:    readCell(row, columns.manufacturerName),
      manufacturerNumbers,
      claimable: columns.claimable === undefined ? true : claimableValue !== 'FALSE',
      category:            readCell(row, columns.category) || undefined,
      subcategory:         readCell(row, columns.subcategory) || undefined,
    };
  }

  return {
    id:                  readCell(row, columns.id),
    name:                readCell(row, columns.name),
    manufacturerName:    readCell(row, columns.manufacturerName),
    unitCostUSD:         parseSheetMoney(readCell(row, columns.unitCostUSD)),
    manufacturerNumbers,
    claimable:           columns.claimable === undefined ? true : claimableValue !== 'FALSE',
    category:            readCell(row, columns.category) || undefined,
    subcategory:         readCell(row, columns.subcategory) || undefined,
  };
}

export async function getProducts(): Promise<Product[]> {
  const info = await getProductSheetInfo();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `Products!A2:${columnLetter(Math.max(info.headers.length - 1, 5))}`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, index) => ({ row, sheetRow: index + 2 }))
    .filter(({ row }) => row[0])
    .map(({ row, sheetRow }) => rowToProduct(row, info, sheetRow));
}

export async function createProduct(
  data: Omit<Product, 'id'>
): Promise<ProductSaveResult> {
  const info = await getProductSheetInfo();
  const { layout } = info;
  const sheets = getSheets();
  const product: Product = { ...data, claimable: data.claimable !== false, id: layout === 'legacy' ? '' : `PROD-${Date.now()}` };
  const row = productToSheetRow(product, info);
  const existingRowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `Products!A2:${columnLetter(Math.max(info.headers.length - 1, row.length - 1))}`,
  });
  const existingRows = existingRowsRes.data.values || [];
  const lastUsedIndex = existingRows.reduce((last, row, index) => row.some(cell => String(cell ?? '').trim()) ? index : last, -1);
  const sheetRow = lastUsedIndex + 3;
  const writeRange = `Products!A${sheetRow}:${columnLetter(row.length - 1)}${sheetRow}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: writeRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  const savedRowRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: writeRange,
  });
  const savedRow = savedRowRes.data.values?.[0];
  if (!savedRow) {
    throw new Error(`Google Sheets accepted the save, but row ${sheetRow} could not be read back from the Products tab.`);
  }

  const savedProduct = rowToProduct(savedRow, info, sheetRow);
  if (!productMatches(savedProduct, product)) {
    throw new Error(`Google Sheets saved row ${sheetRow}, but the values read back did not match the product that was submitted.`);
  }
  return { product: savedProduct, sheetRow, writeRange, layout };
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>
): Promise<void> {
  const info = await getProductSheetInfo();
  const sheets = getSheets();
  const readRange = `Products!A2:${columnLetter(Math.max(info.headers.length - 1, 5))}`;
  const rowsRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: readRange });
  const rows = rowsRes.data.values || [];
  const products = rows.map((row, index) => rowToProduct(row, info, index + 2));
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Product ${id} not found`);

  const updated = { ...products[idx], ...updates };
  const row = productToSheetRow(updated, info, rows[idx]);
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Products!A${sheetRow}:${columnLetter(row.length - 1)}${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const info = await getProductSheetInfo();
  const sheets = getSheets();
  const range = `Products!A2:${columnLetter(Math.max(info.headers.length - 1, 5))}`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const rows = res.data.values || [];
  const filtered = rows.filter((r, index) => {
    const product = rowToProduct(r, info, index + 2);
    return product.id !== id;
  });
  if (filtered.length === rows.length) throw new Error(`Product ${id} not found`);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range });
  if (filtered.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: 'Products!A2',
      valueInputOption: 'RAW', requestBody: { values: filtered },
    });
  }
}

// =========================================================
// MANUFACTURERS
// =========================================================

function rowToManufacturer(row: string[]): Manufacturer {
  return {
    id:           row[0] || '',
    name:         row[1] || '',
    contactEmail: row[2] || '',
    phone:        row[3] || '',
    notes:        row[4] || '',
  };
}

export async function getManufacturers(): Promise<Manufacturer[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Manufacturers!A2:E',
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0]).map(rowToManufacturer);
}

export async function createManufacturer(
  data: Omit<Manufacturer, 'id'>
): Promise<Manufacturer> {
  const sheets = getSheets();
  const mfr: Manufacturer = { ...data, id: `MFR-${Date.now()}` };
  const row = [mfr.id, mfr.name, mfr.contactEmail, mfr.phone, mfr.notes];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Manufacturers!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return mfr;
}

export async function updateManufacturer(
  id: string,
  updates: Partial<Manufacturer>
): Promise<void> {
  const sheets = getSheets();
  const mfrs = await getManufacturers();
  const idx = mfrs.findIndex(m => m.id === id);
  if (idx === -1) throw new Error(`Manufacturer ${id} not found`);
  const updated = { ...mfrs[idx], ...updates };
  const row = [updated.id, updated.name, updated.contactEmail, updated.phone, updated.notes];
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Manufacturers!A${sheetRow}:E${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function deleteManufacturer(id: string): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Manufacturers!A2:E' });
  const rows = res.data.values || [];
  const filtered = rows.filter(r => r[0] !== id);
  if (filtered.length === rows.length) throw new Error(`Manufacturer ${id} not found`);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'Manufacturers!A2:E' });
  if (filtered.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: 'Manufacturers!A2',
      valueInputOption: 'RAW', requestBody: { values: filtered },
    });
  }
}

// =========================================================
// FAULT TYPES
// =========================================================

function rowToFaultType(row: string[]): FaultType {
  return {
    id:          row[0] || '',
    name:        row[1] || '',
    description: row[2] || '',
  };
}

export async function getFaultTypes(): Promise<FaultType[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'FaultTypes!A2:C',
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0]).map(rowToFaultType);
}

export async function createFaultType(
  data: Omit<FaultType, 'id'>
): Promise<FaultType> {
  const sheets = getSheets();
  const ft: FaultType = { ...data, id: `FT-${Date.now()}` };
  const row = [ft.id, ft.name, ft.description];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'FaultTypes!A:C',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return ft;
}

export async function updateFaultType(
  id: string,
  updates: Partial<FaultType>
): Promise<void> {
  const sheets = getSheets();
  const fts = await getFaultTypes();
  const idx = fts.findIndex(f => f.id === id);
  if (idx === -1) throw new Error(`FaultType ${id} not found`);
  const updated = { ...fts[idx], ...updates };
  const row = [updated.id, updated.name, updated.description];
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `FaultTypes!A${sheetRow}:C${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function deleteFaultType(id: string): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'FaultTypes!A2:C' });
  const rows = res.data.values || [];
  const filtered = rows.filter(r => r[0] !== id);
  if (filtered.length === rows.length) throw new Error(`FaultType ${id} not found`);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'FaultTypes!A2:C' });
  if (filtered.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: 'FaultTypes!A2',
      valueInputOption: 'RAW', requestBody: { values: filtered },
    });
  }
}

// =========================================================
// STAFF
// =========================================================

export interface StaffMember { id: string; name: string; }

export async function getStaff(): Promise<StaffMember[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Staff!A2:B',
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0] && r[1]).map(r => ({ id: r[0], name: r[1] }));
}

export async function createStaff(name: string): Promise<StaffMember> {
  const sheets = getSheets();
  const member: StaffMember = { id: `STAFF-${Date.now()}`, name: name.trim() };
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Staff!A:B',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[member.id, member.name]] },
  });
  return member;
}

export async function deleteStaff(id: string): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Staff!A2:B' });
  const rows = res.data.values || [];
  const filtered = rows.filter(r => r[0] !== id);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'Staff!A2:B' });
  if (filtered.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: 'Staff!A2',
      valueInputOption: 'RAW', requestBody: { values: filtered },
    });
  }
}

// =========================================================
// CLAIMS
// =========================================================

function rowToClaim(row: string[]): Claim {
  return {
    id:              row[0] || '',
    manufacturer:    row[1] || '',
    month:           row[2] || '',
    year:            row[3] || '',
    faultCount:      parseInt(row[4])   || 0,
    costAtRisk:      parseFloat(row[5]) || 0,
    amountRecovered: parseFloat(row[6]) || 0,
    status:          (row[7] as ClaimStatus) || 'Unsubmitted',
    notes:           row[8] || '',
    caseIds:         row[9]
      ? row[9].split(',').map(s => s.trim()).filter(Boolean)
      : [],
    outcomeDate:        row[10] || undefined,
    outcomeNotes:       row[11] || undefined,
    resolutionType:     (row[12] as Claim['resolutionType']) || undefined,
    replacementDetails: row[13] || undefined,
  };
}

function claimToRow(c: Claim): string[] {
  return [
    c.id, c.manufacturer, c.month, c.year,
    String(c.faultCount), String(c.costAtRisk), String(c.amountRecovered),
    c.status, c.notes, c.caseIds.join(', '),
    c.outcomeDate || '', c.outcomeNotes || '',
    c.resolutionType || '', c.replacementDetails || '',
  ];
}

export async function getClaims(): Promise<Claim[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Claims!A2:N',
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0]).map(rowToClaim);
}

export async function createClaim(
  data: Omit<Claim, 'id'>
): Promise<Claim> {
  const sheets = getSheets();
  const claim: Claim = { ...data, id: `CLM-${Date.now()}` };
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Claims!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [claimToRow(claim)] },
  });
  return claim;
}

export async function updateClaim(
  id: string,
  updates: Partial<Claim>
): Promise<Claim> {
  const sheets = getSheets();
  const claims = await getClaims();
  const idx = claims.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Claim ${id} not found`);

  const updated: Claim = { ...claims[idx], ...updates };
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Claims!A${sheetRow}:L${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [claimToRow(updated)] },
  });
  return updated;
}

// =========================================================
// BULK STATUS UPDATE
// =========================================================
export async function bulkUpdateCaseStatuses(
  caseIds: string[],
  status: ClaimStatus
): Promise<void> {
  if (!caseIds.length) return;
  const sheets = getSheets();
  await ensureCaseHeaders();
  const allCases = await getCases();

  const data: { range: string; values: string[][] }[] = [];
  for (const id of caseIds) {
    const idx = allCases.findIndex(c => c.id === id);
    if (idx === -1) continue;
    const sheetRow = idx + 2;
    const updated = { ...allCases[idx], claimStatus: status };
    data.push({
      range: `Cases!A${sheetRow}:S${sheetRow}`,
      values: [caseToRow(updated)],
    });
  }

  if (!data.length) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });
}

// Returns module moved to Supabase — see lib/supabase.ts and app/api/returns/
