import { google } from 'googleapis';
import { readFileSync } from 'fs';

const creds = JSON.parse(readFileSync('/Users/anthonynguyen/Downloads/snap-faulty-portal-ec2a82a21df8.json'));
const SHEET_ID = '1B56wWMRO0XvXM9Oz2mFL5_0yuRxz3M7bBHigYBSnp2o';

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const TABS = [
  { name: 'Cases',         headers: ['ID','Date','OrderNumber','CustomerName','Product','ManufacturerName','ManufacturerNumber','FaultType','FaultNotes','EvidenceLink','UnitCostUSD','ClaimStatus','SubmittedBy','CreatedAt'] },
  { name: 'Products',      headers: ['ID','Name','ManufacturerName','UnitCostUSD','ManufacturerNumbers'] },
  { name: 'Manufacturers', headers: ['ID','Name','ContactEmail','Phone','Notes'] },
  { name: 'FaultTypes',    headers: ['ID','Name','Description'] },
  { name: 'Claims',        headers: ['ID','Manufacturer','Month','Year','FaultCount','CostAtRisk','AmountRecovered','Status','Notes','CaseIDs'] },
];

// Get existing sheets
const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const existing = meta.data.sheets.map(s => s.properties.title);
console.log('Existing tabs:', existing.join(', '));

// Add missing tabs
const toAdd = TABS.filter(t => !existing.includes(t.name));
if (toAdd.length > 0) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: toAdd.map(t => ({
        addSheet: { properties: { title: t.name } }
      }))
    }
  });
  console.log('✅ Created tabs:', toAdd.map(t => t.name).join(', '));
} else {
  console.log('ℹ️  All tabs already exist');
}

// Write headers to each tab
for (const tab of TABS) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab.name}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [tab.headers] },
  });
  console.log(`✅ Headers set for: ${tab.name}`);
}

console.log('');
console.log('🎉 Google Sheet is ready!');
