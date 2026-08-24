alter table staff_profiles
  add column if not exists commslayer_agent_id text not null default '',
  add column if not exists performance_primary boolean not null default false;

create index if not exists staff_profiles_commslayer_agent_id_idx
  on staff_profiles(commslayer_agent_id)
  where commslayer_agent_id <> '';
