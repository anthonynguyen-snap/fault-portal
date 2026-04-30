// Australian Public Holidays — National + South Australia specific
// These are informational markers on the roster calendar (no pay treatment rules apply here).

export interface AuHoliday {
  date:  string;             // YYYY-MM-DD
  name:  string;
  scope: 'national' | 'sa'; // 'sa' = South Australia specific
}

export const AU_HOLIDAYS: AuHoliday[] = [
  // ── 2025 ──────────────────────────────────────────────────────────────────
  { date: '2025-01-01', name: "New Year's Day",       scope: 'national' },
  { date: '2025-01-27', name: 'Australia Day',         scope: 'national' }, // observed (26 Jan is Sun)
  { date: '2025-03-10', name: 'Adelaide Cup Day',      scope: 'sa'       }, // 2nd Monday in March
  { date: '2025-04-18', name: 'Good Friday',           scope: 'national' },
  { date: '2025-04-19', name: 'Easter Saturday',       scope: 'sa'       },
  { date: '2025-04-20', name: 'Easter Sunday',         scope: 'national' },
  { date: '2025-04-21', name: 'Easter Monday',         scope: 'national' },
  { date: '2025-04-25', name: 'Anzac Day',             scope: 'national' },
  { date: '2025-06-09', name: "King's Birthday",       scope: 'sa'       }, // 2nd Monday in June
  { date: '2025-10-06', name: 'Labour Day',            scope: 'sa'       }, // 1st Monday in October
  { date: '2025-12-25', name: 'Christmas Day',         scope: 'national' },
  { date: '2025-12-26', name: 'Proclamation Day',      scope: 'sa'       },

  // ── 2026 ──────────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day",       scope: 'national' },
  { date: '2026-01-26', name: 'Australia Day',         scope: 'national' },
  { date: '2026-03-09', name: 'Adelaide Cup Day',      scope: 'sa'       }, // 2nd Monday in March
  { date: '2026-04-03', name: 'Good Friday',           scope: 'national' },
  { date: '2026-04-04', name: 'Easter Saturday',       scope: 'sa'       },
  { date: '2026-04-05', name: 'Easter Sunday',         scope: 'national' },
  { date: '2026-04-06', name: 'Easter Monday',         scope: 'national' },
  { date: '2026-04-25', name: 'Anzac Day',             scope: 'national' },
  { date: '2026-06-08', name: "King's Birthday",       scope: 'sa'       }, // 2nd Monday in June
  { date: '2026-10-05', name: 'Labour Day',            scope: 'sa'       }, // 1st Monday in October
  { date: '2026-12-25', name: 'Christmas Day',         scope: 'national' },
  { date: '2026-12-26', name: 'Proclamation Day',      scope: 'sa'       }, // actual day (Sat)
  { date: '2026-12-28', name: 'Proclamation Day',      scope: 'sa'       }, // additional observed (Mon)
];

// Lookup map: dateStr → holiday
export const AU_HOLIDAY_MAP: Record<string, AuHoliday> = Object.fromEntries(
  AU_HOLIDAYS.map(h => [h.date, h])
);
