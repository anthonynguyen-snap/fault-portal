// Philippine Public Holidays — Regular + Special Non-Working Days
// Sources: Official Proclamations from the Office of the President of the Philippines

export interface PhHoliday {
  date:  string;       // YYYY-MM-DD
  name:  string;
  type:  'regular' | 'special'; // regular = paid non-working; special = paid but may differ
}

export const PH_HOLIDAYS: PhHoliday[] = [
  // ── 2025 ──────────────────────────────────────────────────────────────────
  // Regular
  { date: '2025-01-01', name: "New Year's Day",                    type: 'regular' },
  { date: '2025-04-09', name: 'Day of Valor',                      type: 'regular' },
  { date: '2025-04-17', name: 'Maundy Thursday',                   type: 'regular' },
  { date: '2025-04-18', name: 'Good Friday',                       type: 'regular' },
  { date: '2025-05-01', name: 'Labour Day',                        type: 'regular' },
  { date: '2025-06-12', name: 'Independence Day',                  type: 'regular' },
  { date: '2025-08-25', name: 'National Heroes Day',               type: 'regular' },
  { date: '2025-11-01', name: "All Saints' Day",                   type: 'regular' },
  { date: '2025-11-30', name: 'Bonifacio Day',                     type: 'regular' },
  { date: '2025-12-25', name: 'Christmas Day',                     type: 'regular' },
  { date: '2025-12-30', name: 'Rizal Day',                         type: 'regular' },
  // Special Non-Working
  { date: '2025-02-25', name: 'EDSA Revolution Anniversary',       type: 'special' },
  { date: '2025-04-19', name: 'Black Saturday',                    type: 'special' },
  { date: '2025-08-21', name: 'Ninoy Aquino Day',                  type: 'special' },
  { date: '2025-11-02', name: "All Souls' Day",                    type: 'special' },
  { date: '2025-12-08', name: 'Feast of the Immaculate Conception',type: 'special' },
  { date: '2025-12-24', name: 'Christmas Eve',                     type: 'special' },
  { date: '2025-12-31', name: "New Year's Eve",                    type: 'special' },

  // ── 2026 ──────────────────────────────────────────────────────────────────
  // Regular
  { date: '2026-01-01', name: "New Year's Day",                    type: 'regular' },
  { date: '2026-04-02', name: 'Maundy Thursday',                   type: 'regular' },
  { date: '2026-04-03', name: 'Good Friday',                       type: 'regular' },
  { date: '2026-04-09', name: 'Day of Valor',                      type: 'regular' },
  { date: '2026-05-01', name: 'Labour Day',                        type: 'regular' },
  { date: '2026-06-12', name: 'Independence Day',                  type: 'regular' },
  { date: '2026-08-31', name: 'National Heroes Day',               type: 'regular' },
  { date: '2026-11-01', name: "All Saints' Day",                   type: 'regular' },
  { date: '2026-11-30', name: 'Bonifacio Day',                     type: 'regular' },
  { date: '2026-12-25', name: 'Christmas Day',                     type: 'regular' },
  { date: '2026-12-30', name: 'Rizal Day',                         type: 'regular' },
  // Special Non-Working
  { date: '2026-02-25', name: 'EDSA Revolution Anniversary',       type: 'special' },
  { date: '2026-04-04', name: 'Black Saturday',                    type: 'special' },
  { date: '2026-08-21', name: 'Ninoy Aquino Day',                  type: 'special' },
  { date: '2026-11-02', name: "All Souls' Day",                    type: 'special' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception',type: 'special' },
  { date: '2026-12-24', name: 'Christmas Eve',                     type: 'special' },
  { date: '2026-12-31', name: "New Year's Eve",                    type: 'special' },
];

// Lookup map: dateStr → holiday
export const PH_HOLIDAY_MAP: Record<string, PhHoliday> = Object.fromEntries(
  PH_HOLIDAYS.map(h => [h.date, h])
);
