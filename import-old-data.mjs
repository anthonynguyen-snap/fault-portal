/**
 * import-old-data.mjs
 * Imports old CSV data into the fault portal, skipping duplicate order numbers.
 * Looks up missing cost/manufacturer from the existing Products sheet.
 * Run: node import-old-data.mjs
 */
import { google } from 'googleapis';
import { readFileSync } from 'fs';

const CREDS_PATH = '/Users/anthonynguyen/Downloads/snap-faulty-portal-ec2a82a21df8.json';
const PORTAL_SHEET_ID = '1B56wWMRO0XvXM9Oz2mFL5_0yuRxz3M7bBHigYBSnp2o';
const CSV_PATH = '/tmp/old_import.csv';

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // skip header row if it starts with "date" or a date-like pattern
  const rows = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 7) continue;
    const date = parts[0].trim();
    // skip if not a date-like value (header check)
    if (!date.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;
    rows.push({
      date: parseDate(date),
      orderNumber: (parts[1] || '').trim(),
      customerName: (parts[2] || '').trim(),
      product: (parts[3] || '').trim(),
      costRaw: (parts[4] || '').trim(),
      manufacturer: (parts[5] || '').trim(),
      faultType: (parts[6] || '').trim(),
      faultNotes: (parts[7] || '').trim(),
      evidenceLink: parts.slice(8).join(',').trim(),
    });
  }
  return rows;
}

function parseDate(raw) {
  // DD/MM/YYYY -> YYYY-MM-DD
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return raw;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseCost(raw) {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

async function readTab(range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: PORTAL_SHEET_ID, range });
  return res.data.values || [];
}

async function appendRows(range, rows) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: PORTAL_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows }
  });
}

async function main() {
  console.log('Reading CSV...');
  const csvText = readFileSync(CSV_PATH, 'utf8');
  const oldRows = parseCSV(csvText);
  console.log(`Parsed ${oldRows.length} rows from CSV`);

  // Read existing Products for cost/manufacturer lookup
  console.log('Reading Products sheet...');
  const existingProducts = await readTab('Products!A2:E');
  const productLookup = new Map(); // name.toLowerCase() -> { manufacturer, cost, id }
  const existingProductNames = new Set();
  for (const r of existingProducts) {
    const name = (r[1] || '').trim();
    const key = name.toLowerCase();
    existingProductNames.add(key);
    productLookup.set(key, {
      id: r[0] || '',
      name: name,
      manufacturer: (r[2] || '').trim(),
      cost: parseCost(r[3] || ''),
    });
  }
  console.log(`Loaded ${productLookup.size} products`);

  // Read existing Manufacturers
  const existingMfrs = await readTab('Manufacturers!A2:E');
  const existingMfrNames = new Set(existingMfrs.map(r => (r[1] || '').trim().toLowerCase()));

  // Read existing FaultTypes
  const existingFTs = await readTab('FaultTypes!A2:C');
  const existingFTNames = new Set(existingFTs.map(r => (r[1] || '').trim().toLowerCase()));

  // Read existing Cases to find duplicate order numbers
  console.log('Reading existing Cases...');
  const existingCases = await readTab('Cases!A2:N');
  const existingOrders = new Set(existingCases.map(r => (r[2] || '').trim()));
  console.log(`Found ${existingOrders.size} existing order numbers`);

  // Process rows — fill in missing data from product lookup
  const newProducts = [];
  const newMfrs = [];
  const newFTs = [];
  const newCases = [];
  let skipped = 0;
  let pc = Date.now(), mc = Date.now() + 10000, ftc = Date.now() + 20000, cc = Date.now() + 30000;

  for (const r of oldRows) {
    if (!r.orderNumber) continue;
    if (existingOrders.has(r.orderNumber)) { skipped++; continue; }

    // Try to fill missing manufacturer/cost from Products sheet
    let manufacturer = r.manufacturer;
    let cost = parseCost(r.costRaw);

    const productKey = r.product.toLowerCase();
    // Try exact match first, then substring match
    let productInfo = productLookup.get(productKey);
    if (!productInfo) {
      for (const [key, info] of productLookup) {
        if (key.includes(productKey) || productKey.includes(key)) {
          productInfo = info;
          break;
        }
      }
    }
    if (productInfo) {
      if (!manufacturer) manufacturer = productInfo.manufacturer;
      if (cost === 0 && productInfo.cost > 0) cost = productInfo.cost;
    }

    // Track new products
    if (!existingProductNames.has(productKey)) {
      existingProductNames.add(productKey);
      newProducts.push(['PROD-' + pc++, r.product, manufacturer, String(cost), '']);
      productLookup.set(productKey, { name: r.product, manufacturer, cost });
    }

    // Track new manufacturers
    if (manufacturer && !existingMfrNames.has(manufacturer.toLowerCase())) {
      existingMfrNames.add(manufacturer.toLowerCase());
      newMfrs.push(['MFR-' + mc++, manufacturer, '', '', '']);
    }

    // Track new fault types
    if (r.faultType && !existingFTNames.has(r.faultType.toLowerCase())) {
      existingFTNames.add(r.faultType.toLowerCase());
      newFTs.push(['FT-' + ftc++, r.faultType, '']);
    }

    const now = new Date().toISOString();
    newCases.push([
      'CASE-' + cc++,
      r.date,
      r.orderNumber,
      r.customerName,
      r.product,
      manufacturer,
      '',             // manufacturerNumber (not in old data)
      r.faultType,
      r.faultNotes,
      r.evidenceLink,
      String(cost),
      'Unsubmitted',
      'Import',
      now,
    ]);
    existingOrders.add(r.orderNumber);
  }

  console.log(`Skipped ${skipped} duplicates`);

  if (newProducts.length) {
    await appendRows('Products!A:E', newProducts);
    console.log(`Added ${newProducts.length} new products`);
  }
  if (newMfrs.length) {
    await appendRows('Manufacturers!A:E', newMfrs);
    console.log(`Added ${newMfrs.length} new manufacturers`);
  }
  if (newFTs.length) {
    await appendRows('FaultTypes!A:C', newFTs);
    console.log(`Added ${newFTs.length} new fault types`);
  }

  if (!newCases.length) {
    console.log('No new cases to import.');
    return;
  }

  console.log(`Importing ${newCases.length} cases...`);
  const BATCH = 100;
  for (let i = 0; i < newCases.length; i += BATCH) {
    await appendRows('Cases!A:N', newCases.slice(i, i + BATCH));
    console.log(`Wrote rows ${i + 1}–${Math.min(i + BATCH, newCases.length)}`);
  }
  console.log(`Done! Imported ${newCases.length} cases.`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
