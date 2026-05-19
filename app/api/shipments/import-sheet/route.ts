import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ── Google Sheet details ───────────────────────────────────────────────────────
const SHEET_ID  = '1TjIecJNYF5Xs73nnSvFO7GjcijdRkUrbJNG9O-3WnQs';
const SHEET_GID = '2063969434';
const CSV_URL   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// ── Row label identifiers (matched against column A/B) ────────────────────────
const ROW_LABELS: Record<string, string> = {
  location:   'Location',
  transport:  'Air/Sea',
  provider:   'Provider',
  tracking:   'Tracking',
  eta:        'ETA',
  status:     'Status',
  notes:      'Notes',
  costUsd:    'Cost (USD)',
  costAud:    'Cost (AUD)',
  cartons:    'Cartons',
  weight:     'Weight',
  trf:        'Branch Transfer',
  asn:        'ASN',
};

// ── Simple CSV parser (handles quoted fields) ─────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQuote = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// ── Date parsing: "28 May 2026" or "25/05/2026" → "2026-05-28" ───────────────
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();

  // "28 May 2026"
  const longMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (longMatch) {
    const months: Record<string, string> = {
      jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
      jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
    };
    const m = months[longMatch[2].toLowerCase().slice(0, 3)];
    if (m) return `${longMatch[3]}-${m}-${longMatch[1].padStart(2, '0')}`;
  }

  // "25/05/2026" or "25-05-2026"
  const slashMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2].padStart(2,'0')}-${slashMatch[1].padStart(2,'0')}`;

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  return null;
}

// ── Parse cost: "$1,882.00" or "1882" → 1882 ─────────────────────────────────
function parseCost(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
}

// ── Status mapping ────────────────────────────────────────────────────────────
function mapStatus(raw: string): string {
  const s = raw.toUpperCase().trim();
  if (s.includes('PROGRESS') || s.includes('TRANSIT')) return 'In Transit';
  if (s.includes('PORT') || s.includes('CUSTOMS')) return 'At Port';
  if (s.includes('DELIVER')) return 'Delivered';
  if (s.includes('DELAY')) return 'Delayed';
  if (s.includes('PENDING')) return 'Pending';
  return 'In Transit'; // default for IN PROGRESS
}

export interface ImportedShipmentItem {
  productName: string;
  sku: string;
  quantity: number;
  notes: string;
}

export interface ImportedShipment {
  shipmentNumber: string;
  location: string;
  transportType: 'Sea' | 'Air';
  provider: string;
  trackingNumber: string;
  eta: string | null;
  status: string;
  costUsd: number;
  costAud: number;
  cartons: string;
  weightKg: string;
  branchTransferNumber: string;
  asnNumber: string;
  notes: string;
  items: ImportedShipmentItem[];
}

export async function GET() {
  try {
    // 1. Fetch CSV
    const res = await fetch(CSV_URL, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          error: 'Sheet is not publicly accessible. Please set sharing to "Anyone with the link can view" in Google Sheets.',
        }, { status: 403 });
      }
      return NextResponse.json({ error: `Failed to fetch sheet: HTTP ${res.status}` }, { status: 500 });
    }

    const csv  = await res.text();
    const rows = parseCSV(csv);
    if (!rows.length) return NextResponse.json({ error: 'Sheet appears to be empty' }, { status: 400 });

    // 2. Find the header row — look for a row where any cell contains "SHIPMENT #"
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      if (rows[r].some(cell => /SHIPMENT\s*#/i.test(cell))) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) {
      return NextResponse.json({ error: 'Could not find shipment header row. Ensure the sheet tab is correct.' }, { status: 400 });
    }

    // 3. Identify which columns are shipments (cells matching "SHIPMENT #NNN")
    const headerRow = rows[headerRowIdx];
    const shipmentCols: Array<{ col: number; number: string }> = [];
    for (let c = 0; c < headerRow.length; c++) {
      const match = headerRow[c].match(/SHIPMENT\s*#\s*(\d+)/i);
      if (match) shipmentCols.push({ col: c, number: match[1] });
    }
    if (!shipmentCols.length) {
      return NextResponse.json({ error: 'No shipment columns found in header row.' }, { status: 400 });
    }

    // 4. Build a label → rowIndex map (search first 2 columns for known labels)
    const labelRowMap: Record<string, number> = {};
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const label = (rows[r][0] || rows[r][1] || '').trim();
      if (!label) continue;
      for (const [key, pattern] of Object.entries(ROW_LABELS)) {
        if (label.toLowerCase().includes(pattern.toLowerCase()) && !(key in labelRowMap)) {
          labelRowMap[key] = r;
        }
      }
    }

    // 5. Find "Main Sellers" section — product rows start after this
    let mainSellersRow = -1;
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const label = (rows[r][0] || rows[r][1] || '').trim().toLowerCase();
      if (label.includes('main seller') || label.includes('main product')) {
        mainSellersRow = r;
        break;
      }
    }

    // 6. Collect product names from the Main Sellers section
    const productRows: Array<{ rowIdx: number; name: string }> = [];
    if (mainSellersRow !== -1) {
      for (let r = mainSellersRow + 1; r < rows.length; r++) {
        const name = (rows[r][0] || rows[r][1] || '').trim();
        if (!name) continue;
        // Stop if we hit another section header (all-caps label, no numbers in a data column)
        if (/^[A-Z\s\/\-]+$/.test(name) && name.length > 20) break;
        productRows.push({ rowIdx: r, name });
      }
    }

    // 7. Build ImportedShipment objects
    const getCell = (rowKey: string, col: number) =>
      labelRowMap[rowKey] !== undefined ? (rows[labelRowMap[rowKey]]?.[col] ?? '') : '';

    const shipments: ImportedShipment[] = shipmentCols.map(({ col, number }) => {
      const rawTransport = getCell('transport', col).trim().toUpperCase();
      const items: ImportedShipmentItem[] = productRows
        .map(({ rowIdx, name }) => {
          const raw = rows[rowIdx]?.[col] ?? '';
          const qty = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
          return qty > 0 ? { productName: name, sku: '', quantity: qty, notes: '' } : null;
        })
        .filter((x): x is ImportedShipmentItem => x !== null);

      return {
        shipmentNumber:       number,
        location:             getCell('location', col),
        transportType:        rawTransport.includes('AIR') ? 'Air' : 'Sea',
        provider:             getCell('provider', col),
        trackingNumber:       getCell('tracking', col),
        eta:                  parseDate(getCell('eta', col)),
        status:               mapStatus(getCell('status', col)),
        costUsd:              parseCost(getCell('costUsd', col)),
        costAud:              parseCost(getCell('costAud', col)),
        cartons:              getCell('cartons', col),
        weightKg:             getCell('weight', col),
        branchTransferNumber: getCell('trf', col),
        asnNumber:            getCell('asn', col),
        notes:                getCell('notes', col),
        items,
      };
    });

    return NextResponse.json({ data: shipments, count: shipments.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
