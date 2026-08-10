insert into replenishment_store_addresses (store)
values ('Melbourne Airport')
on conflict (store) do nothing;
