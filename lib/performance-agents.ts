import { getSupabase } from '@/lib/supabase';

export type PerformanceAgentConfig = {
  staffName: string;
  commslayerAgentId: string;
  performancePrimary: boolean;
};

function fromRow(row: Record<string, unknown>): PerformanceAgentConfig {
  return {
    staffName: String(row.staff_name ?? ''),
    commslayerAgentId: String(row.commslayer_agent_id ?? '').trim(),
    performancePrimary: Boolean(row.performance_primary),
  };
}

export async function getPerformanceAgentConfig(): Promise<PerformanceAgentConfig[]> {
  const { data, error } = await getSupabase()
    .from('staff_profiles')
    .select('staff_name, commslayer_agent_id, performance_primary')
    .neq('commslayer_agent_id', '')
    .order('staff_name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function getPrimaryPerformanceAgentIds(): Promise<string[]> {
  const config = await getPerformanceAgentConfig();
  return config
    .filter(agent => agent.performancePrimary && agent.commslayerAgentId)
    .map(agent => agent.commslayerAgentId);
}
