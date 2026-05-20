/**
 * import-data.mjs
 * Imports all rows from the source Google Sheet into the fault portal.
 * Run: node import-data.mjs
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import https from 'https';

const CREDS_PATH  = '/Users/anthonynguyen/Downloads/snap-faulty-portal-ec2a82a21df8.json';
const PORTAL_SHEET_ID = '1B56wWMRO0XvXM9Oz2mFL5_0yuRxz3M7bBHigYBSnp2o';
const SOURCE_SHEET_ID = '1C-ydJH3loLuKANghanXp5LMCxPRht_gU1Djtes1Lad0';

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));
const auth  = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

async function fetchSourceRows() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SOURCE_SHEET_ID}/gviz/tq?tqx=out:json`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const start = body.indexOf('{'); const end = body.lastIndexOf('}') + 1;
          const data = JSON.parse(body.slice(start, end));
          const rows = data.table.rows.map(r => {
            const c = r.c || [];
            const val = (i) => (c[i] && c[i].v != null) ? String(c[i].v) : '';
            return { date: val(0), orderNumber: val(1).trim(), customerName: val(2).trim(), product: val(3).trim(), manufacturer: val(4).trim(), manufacturerNumber: val(5).trim(), faultType: val(6).trim(), faultNotes: val(7).trim(), unitCost: val(8), evidenceLink: val(9).trim() };
          });
          resolve(rows);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function parseDate(raw) {
  const m = raw.match(/Date\((\d+),(\d+),(\d+)\)/);
  if (!m) return raw;
  const d = new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])));
  return d.toISOString().split('T')[0];
}

function parseCost(raw) {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

async function readTab(range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: PORTAL_SHEET_ID, range });
  return res.data.values || [];
}

async function appendRows(range, rows) {
  await sheets.spreadsheets.values.append({ spreadsheetId: PORTAL_SHEET_ID, range, valueInputOption: 'USER_ENTERED', requestBody: { values: rows } });
}

async function main() {
  console.log('Fetching source data...');
  const sourceRows = await fetchSourceRows();
  console.log(sourceRows.length + ' rows fetched');

  console.log('Syncing Products...');
  const existingProducts = await readTab('Products!A2:E');
  const existingProductNames = new Set(existingProducts.map(r => (r[1]||'').trim().toLowerCase()));
  const productMap = new Map();
  for (const r of sourceRows) { if (!r.product) continue; const key = r.product.toLowerCase(); if (!productMap.has(key)) productMap.set(key, { name: r.product, manufacturer: r.manufacturer, cost: parseCost(r.unitCost) }); }
  const newProducts = []; let pc = Date.now();
  for (const [key, p] of productMap) { if (!existingProductNames.has(key)) newProducts.push(['PROD-' + pc++, p.name, p.manufacturer, String(p.cost), '']); }
  if (newProducts.length) { await appendRows('Products!A:E', newProducts); console.log('Added ' + newProducts.length + ' products'); }

  console.log('Syncing Manufacturers...');
  const existingMfrs = await readTab('Manufacturers!A2:E');
  const existingMfrNames = new Set(existingMfrs.map(r => (r[1]||'').trim().toLowerCase()));
  const uniqueMfrs = [...new Set(sourceRows.map(r => r.manufacturer).filter(Boolean))];
  const newMfrs = []; let mc = Date.now();
  for (const name of uniqueMfrs) { if (!existingMfrNames.has(name.trim().toLowerCase())) newMfrs.push(['MFR-' + mc++, name.trim(), '', '', '']); }
  if (newMfrs.length) { await appendRows('Manufacturers!A:E', newMfrs); console.log('Added ' + newMfrs.length + ' manufacturers'); }

  console.log('Syncing Fault Types...');
  const existingFTs = await readTab('FaultTypes!A2:C');
  const existingFTNames = new Set(existingFTs.map(r => (r[1]||'').trim().toLowerCase()));
  const uniqueFTs = [...new Set(sourceRows.map(r => r.faultType).filter(Boolean))];
  const newFTs = []; let ftc = Date.now();
  for (const name of uniqueFTs) { if (!existingFTNames.has(name.trim().toLowerCase())) newFTs.push(['FT-' + ftc++, name.trim(), '']); }
  if (newFTs.length) { await appendRows('FaultTypes!A:C', newFTs); console.log('Added ' + newFTs.length + ' fault types'); }

  console.log('Importing Cases...');
  const existingCases = await readTab('Cases!A2:N');
  const existingOrders = new Set(existingCases.map(r => (r[2]||'').trim()));
  const now = new Date().toISOString(); let cc = Date.now();
  const newCases = [];
  for (const r of sourceRows) {
    if (!r.orderNumber || existingOrders.has(r.orderNumber)) continue;
    newCases.push(['CASE-' + cc++, parseDate(r.date), r.orderNumber, r.customerName, r.product, r.manufacturer, r.manufacturerNumber, r.faultType, r.faultNotes, r.evidenceLink, String(parseCost(r.unitCost)), 'Unsubmitted', 'Import', now]);
  }
  if (!newCases.length) { console.log('No new cases to import'); return; }
  const BATCH = 100;
  for (let i = 0; i < newCases.length; i += BATCH) {
    await appendRows('Cases!A:N', newCases.slice(i, i + BATCH));
    console.log('Wrote rows ' + (i+1) + '-' + Math.min(i+BATCH, newCases.length));
  }
  console.log('Done! Imported ' + newCases.length + ' cases.');
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });