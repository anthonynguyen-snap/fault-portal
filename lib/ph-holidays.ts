// Philippine Regular Holidays — as recognised under contractor agreements (Schedule B)
// Only the 10 Regular Holidays listed in Schedule B apply.
// Special Non-Working Days are NOT recognised under these agreements.
//
// PAY TREATMENT (per SnapWireless contractor agreements):
//   regular  → No pay if day off; 200% rate if worked at Company request

export interface PhHoliday {
  date:  string;       // YYYY-MM-DD
  name:  string;
  type:  'regular';
}

export function isDoublePay(h: PhHoliday): boolean {
  return h.type === 'regular';
}

export const PH_HOLIDAYS: PhHoliday[] = [
  // ── 2025 ──────────────────────────────────────────────────────────────────
  // 10 Regular Holidays (Schedule B equivalent for 2025)
  { date: '2025-01-01', name: "New Year's Day",      type: 'regular' },
  { date: '2025-04-17', name: 'Maundy Thursday',     type: 'regular' },
  { date: '2025-04-18', name: 'Good Friday',          type: 'regular' },
  { date: '2025-04-09', name: 'Day of Valor',         type: 'regular' },
  { date: '2025-05-01', name: 'Labor Day',             type: 'regular' },
  { date: '2025-06-12', name: 'Independence Day',     type: 'regular' },
  { date: '2025-08-25', name: "National Heroes' Day", type: 'regular' },
  { date: '2025-11-30', name: 'Bonifacio Day',        type: 'regular' },
  { date: '2025-12-25', name: 'Christmas Day',        type: 'regular' },
  { date: '2025-12-30', name: 'Rizal Day',             type: 'regular' },

  // ── 2026 ──────────────────────────────────────────────────────────────────
  // 10 Regular Holidays per Schedule B of contractor agreements
  { date: '2026-01-01', name: "New Year's Day",      type: 'regular' },
  { date: '2026-04-02', name: 'Maundy Thursday',     type: 'regular' },
  { date: '2026-04-03', name: 'Good Friday',          type: 'regular' },
  { date: '2026-04-09', name: 'Day of Valor',         type: 'regular' },
  { date: '2026-05-01', name: 'Labor Day',             type: 'regular' },
  { date: '2026-06-12', name: 'Independence Day',     type: 'regular' },
  { date: '2026-08-31', name: "National Heroes' Day", type: 'regular' },
  { date: '2026-11-30', name: 'Bonifacio Day',        type: 'regular' },
  { date: '2026-12-25', name: 'Christmas Day',        type: 'regular' },
  { date: '2026-12-30', name: 'Rizal Day',             type: 'regular' },
];

// Lookup map: dateStr → holiday
export const PH_HOLIDAY_MAP: Record<string, PhHoliday> = Object.fromEntries(
  PH_HOLIDAYS.map(h => [h.date, h])
);
