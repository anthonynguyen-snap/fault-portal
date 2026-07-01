// =========================================================
// PROMOTIONS — shared timing / suppression helpers
//
// These are used by both the Promotions admin page and the dashboard
// widgets so "is this promo actually running right now" and "is it
// suppressed by a major sale" are computed identically everywhere.
// =========================================================

export type PromoTiming = {
  startDate: string;
  startTime?: string | null;
  endDate: string | null;
  endTime?: string | null;
};

export type SuppressiblePromo = PromoTiming & {
  id: string;
  platform: string;
  isMajor: boolean;
  enabled: boolean;
};

/**
 * Combine a date + optional time into a millisecond timestamp.
 * Missing time defaults to start-of-day for start instants and
 * end-of-day for end instants, matching the "ends 12:00am on X" /
 * whole-day semantics already used elsewhere in the app.
 *
 * Note: this parses in the server/browser's local timezone (same as
 * the rest of the promotions code, e.g. `new Date(iso + 'T00:00:00')`
 * on the client). It is not timezone-aware across AEST/ACST — good
 * enough for "did this go live yet" at day/hour granularity, not for
 * to-the-minute precision.
 */
function toInstant(date: string | null | undefined, time: string | null | undefined, endOfDay: boolean): number {
  if (!date) return endOfDay ? Infinity : -Infinity;
  const t = time && time.trim() ? time : (endOfDay ? '23:59:59' : '00:00:00');
  const parsed = new Date(`${date}T${t}`).getTime();
  return Number.isNaN(parsed) ? (endOfDay ? Infinity : -Infinity) : parsed;
}

export function promoStartInstant(p: PromoTiming): number {
  return toInstant(p.startDate, p.startTime, false);
}

export function promoEndInstant(p: PromoTiming): number {
  return toInstant(p.endDate, p.endTime, true);
}

/**
 * True if the promo's window actually contains `now` — i.e. it has
 * started (not merely been created with a future start date) and has
 * not yet ended. This is distinct from the "isActive" field returned
 * by the API, which only means "not archived" (hasn't been given a
 * past end date) and ignores the start date entirely.
 */
export function isPromoLiveNow(p: PromoTiming, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= promoStartInstant(p) && t <= promoEndInstant(p);
}

/** True if the promo's start date/time hasn't arrived yet. */
export function promoHasNotStartedYet(p: PromoTiming, now: Date = new Date()): boolean {
  return now.getTime() < promoStartInstant(p);
}

/**
 * Two storefront values "overlap" if they're the same store, or either
 * one is "All Stores" (which by definition covers every storefront).
 */
export function platformsOverlap(a: string, b: string): boolean {
  return a === b || a === 'All Stores' || b === 'All Stores';
}

/**
 * Given the full promo list, returns a Map from promo id -> the major
 * sale promo currently suppressing it (if any).
 *
 * Rules:
 * - Only a promo that is enabled, is not itself a major sale, and has
 *   actually started (per isPromoLiveNow) can be suppressed.
 * - It's suppressed only by a major sale that is enabled, live right
 *   now, and shares a storefront (platformsOverlap).
 * - Major sales never suppress other major sales — if two major sales
 *   overlap on the same storefront that's a data problem to flag
 *   separately, not something to silently resolve here.
 *
 * This is computed fresh from whatever promo list is passed in — there
 * is no stored "suppressed" flag anywhere, so nothing can drift or get
 * stuck: as soon as the major sale's window ends (or it's paused), the
 * next read of this function un-suppresses everything automatically.
 */
export function computeSuppressions<T extends SuppressiblePromo>(
  promos: T[],
  now: Date = new Date(),
): Map<string, T> {
  const liveMajors = promos.filter(p => p.isMajor && p.enabled && isPromoLiveNow(p, now));
  const map = new Map<string, T>();
  if (!liveMajors.length) return map;

  for (const p of promos) {
    if (p.isMajor || !p.enabled) continue;
    if (!isPromoLiveNow(p, now)) continue;
    const major = liveMajors.find(m => platformsOverlap(m.platform, p.platform));
    if (major) map.set(p.id, major);
  }
  return map;
}
