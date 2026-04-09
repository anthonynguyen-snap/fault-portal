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

const CASES_RANGE = 'Cases!A2:N';
const CASES_COLUMNS = 'Cases!A:N';

function rowToCase(row: string[]): FaultCase {
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
  ];
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
    id: `CASE-${Date.now()}`,
    claimStatus: data.claimStatus || 'Unsubmitted',
    createdAt: new Date().toISOString(),
  };

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

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Cases!A${sheetRow}:N${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [caseToRow(updated)] },
  });

  return updated;
}

// =========================================================
// PRODUCTS
// =========================================================

function rowToProduct(row: string[]): Product {
  return {
    id:                 row[0] || '',
    name:               row[1] || '',
    manufacturerName:   row[2] || '',
    unitCostUSD:        parseFloat(row[3]) || 0,
    manufacturerNumbers: row[4]
      ? row[4].split(',').map(s => s.trim()).filter(Boolean)
      : [],
  };
}

export async function getProducts(): Promise<Product[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Products!A2:E',
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0]).map(rowToProduct);
}

export async function createProduct(
  data: Omit<Product, 'id'>
): Promise<Product> {
  const sheets = getSheets();
  const product: Product = { ...data, id: `PROD-${Date.now()}` };
  const row = [
    product.id,
    product.name,
    product.manufacturerName,
    String(product.unitCostUSD),
    product.manufacturerNumbers.join(', '),
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Products!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return product;
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>
): Promise<void> {
  const sheets = getSheets();
  const products = await getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Product ${id} not found`);

  const updated = { ...products[idx], ...updates };
  const row = [
    updated.id,
    updated.name,
    updated.manufacturerName,
    String(updated.unitCostUSD),
    updated.manufacturerNumbers.join(', '),
  ];
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Products!A${sheetRow}:E${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const sheets = getSheets();
  const products = await getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Product ${id} not found`);
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `Products!A${sheetRow}:E${sheetRow}`,
  });
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
  const mfrs = await getManufacturers();
  const idx = mfrs.findIndex(m => m.id === id);
  if (idx === -1) throw new Error(`Manufacturer ${id} not found`);
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `Manufacturers!A${sheetRow}:E${sheetRow}`,
  });
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
  const fts = await getFaultTypes();
  const idx = fts.findIndex(f => f.id === id);
  if (idx === -1) throw new Error(`FaultType ${id} not found`);
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `FaultTypes!A${sheetRow}:C${sheetRow}`,
  });
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
  };
}

function claimToRow(c: Claim): string[] {
  return [
    c.id, c.manufacturer, c.month, c.year,
    String(c.faultCount), String(c.costAtRisk), String(c.amountRecovered),
    c.status, c.notes, c.caseIds.join(', '),
  ];
}

export async function getClaims(): Promise<Claim[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Claims!A2:J',
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
    range: 'Claims!A:J',
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
    range: `Claims!A${sheetRow}:J${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [claimToRow(updated)] },
  });
  return updated;
}
