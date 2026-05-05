import { getSupabase } from '@/lib/supabase';

export interface ActivityEntry {
  actor?:       string;
  action:       string;   // e.g. 'refund.submitted', 'case.updated'
  entityType:   string;   // 'Refund' | 'Return' | 'Case' | 'Replenishment' | ...
  entityId?:    string;
  entityLabel?: string;   // human-readable identifier shown in the log
  detail?:      Record<string, unknown>;
}

/**
 * Fire-and-forget activity log insert.
 * Never throws — logging must never break the main operation.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await getSupabase().from('activity_log').insert({
      actor:        entry.actor        ?? '',
      action:       entry.action,
      entity_type:  entry.entityType,
      entity_id:    entry.entityId     ?? '',
      entity_label: entry.entityLabel  ?? '',
      detail:       entry.detail       ?? {},
    });
  } catch {
    // Intentionally swallowed — log failures must never surface to the user
  }
}
