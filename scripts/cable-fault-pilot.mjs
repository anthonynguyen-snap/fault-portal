import { createRequire } from 'node:module';
import { writeFile, readFile } from 'node:fs/promises';

const require = createRequire(`${process.cwd()}/package.json`);
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SAMPLE_PER_SUBTYPE = 10;
const mappings = [
  { subtype: 'USB-C', labels: ['usb-c cable (broke/not working)'] },
  { subtype: 'Lightning', labels: ['lightning cable (broke/not working)', 'lightning cable fault', 'lightning cable plug broken'] },
];

function getAuth(scope) {
  return new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: [scope],
  });
}

async function loadRows(sheets) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Cases!A2:Q' });
  return (response.data.values || []).map((values, index) => ({ sheetRow: index + 2, values }));
}

function selectPilotRows(rows) {
  return mappings.flatMap(mapping => rows
    .filter(row => mapping.labels.includes(String(row.values[7] || '').trim().toLowerCase()) && !row.values[16])
    .slice(0, SAMPLE_PER_SUBTYPE)
    .map(row => ({ ...row, subtype: mapping.subtype }))
  );
}

async function rollback(backupPath) {
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  const sheets = google.sheets({ version: 'v4', auth: getAuth('https://www.googleapis.com/auth/spreadsheets') });
  for (const row of backup.rows) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Cases!A${row.sheetRow}:Q${row.sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [row.values] },
    });
  }
  console.log(JSON.stringify({ rolledBack: backup.rows.length, backupPath }, null, 2));
}

async function run() {
  const rollbackArg = process.argv.find(arg => arg.startsWith('--rollback='));
  if (rollbackArg) return rollback(rollbackArg.slice('--rollback='.length));

  const apply = process.argv.includes('--apply');
  const scope = apply ? 'https://www.googleapis.com/auth/spreadsheets' : 'https://www.googleapis.com/auth/spreadsheets.readonly';
  const sheets = google.sheets({ version: 'v4', auth: getAuth(scope) });
  const rows = await loadRows(sheets);
  const selected = selectPilotRows(rows);
  const preview = selected.map(row => ({ sheetRow: row.sheetRow, caseId: row.values[0], oldFaultType: row.values[7], newFaultType: 'Cable Fault', newFaultSubtype: row.subtype }));

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', samplePerSubtype: SAMPLE_PER_SUBTYPE, selected: preview }, null, 2));
    return;
  }

  if (selected.length !== SAMPLE_PER_SUBTYPE * mappings.length) {
    throw new Error(`Expected ${SAMPLE_PER_SUBTYPE * mappings.length} pilot rows but found ${selected.length}; no changes made.`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `/tmp/fault-portal-cable-pilot-backup-${timestamp}.json`;
  await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), migration: 'cable-fault-pilot-v1', rows: selected.map(({ sheetRow, values }) => ({ sheetRow, values })) }, null, 2));

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Cases!Q1',
    valueInputOption: 'RAW',
    requestBody: { values: [['Fault Subtype']] },
  });

  for (const row of selected) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `Cases!H${row.sheetRow}`, values: [['Cable Fault']] },
          { range: `Cases!Q${row.sheetRow}`, values: [[row.subtype]] },
        ],
      },
    });
  }

  const faultTypes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'FaultTypes!A2:C' });
  const hasCableFault = (faultTypes.data.values || []).some(row => String(row[1] || '').trim().toLowerCase() === 'cable fault');
  if (!hasCableFault) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'FaultTypes!A:C',
      valueInputOption: 'RAW',
      requestBody: { values: [[`FT-${Date.now()}`, 'Cable Fault', 'USB-C, Lightning or other cable fault']] },
    });
  }

  const after = await loadRows(sheets);
  const reconciled = preview.every(item => {
    const row = after.find(candidate => candidate.sheetRow === item.sheetRow);
    return row?.values[0] === item.caseId && row?.values[7] === 'Cable Fault' && row?.values[16] === item.newFaultSubtype;
  });
  if (!reconciled) throw new Error(`Migration writes did not reconcile. Roll back with: node scripts/cable-fault-pilot.mjs --rollback=${backupPath}`);

  console.log(JSON.stringify({ mode: 'applied', migrated: selected.length, reconciled, backupPath, rollbackCommand: `node scripts/cable-fault-pilot.mjs --rollback=${backupPath}` }, null, 2));
}

run().catch(error => {
  console.error(error.message);
  process.exit(1);
});
