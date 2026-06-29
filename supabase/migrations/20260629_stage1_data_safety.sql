-- Stage 1 data safety: transactional return writes and replenishment dispatch.

alter table replenishment_requests
  add column if not exists storeroom_dispatched boolean not null default false,
  add column if not exists storeroom_tracking text not null default '',
  add column if not exists storeroom_dispatch_date date,
  add column if not exists tpl_dispatched boolean not null default false,
  add column if not exists tpl_tracking text not null default '',
  add column if not exists tpl_dispatch_date date;

alter table replenishment_items
  add column if not exists skipped boolean not null default false;

create or replace function create_return_with_items(
  p_return jsonb,
  p_items jsonb,
  p_close_refunds boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return_id uuid;
  v_item jsonb;
  v_closed_refund_ids uuid[] := '{}';
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'At least one return item is required';
  end if;

  insert into returns (
    stage, date, order_number, customer_name, customer_email,
    tracking_number, parcel_received, linked_request_id,
    starshipit_order_number, product, condition, decision,
    restocking_fee, refund_amount, assigned_to, follow_up_status,
    follow_up_notes, notes, status, processed_by, conversation_link
  ) values (
    coalesce(p_return->>'stage', 'processed'),
    coalesce(nullif(p_return->>'date', ''), current_date::text),
    p_return->>'orderNumber',
    p_return->>'customerName',
    coalesce(p_return->>'customerEmail', ''),
    coalesce(p_return->>'trackingNumber', ''),
    coalesce((p_return->>'parcelReceived')::boolean, false),
    nullif(p_return->>'linkedRequestId', '')::uuid,
    coalesce(p_return->>'starshipitOrderNumber', ''),
    '', 'Sealed', 'Pending', 0, 0,
    coalesce(p_return->>'assignedTo', ''),
    coalesce(p_return->>'followUpStatus', 'N/A'),
    coalesce(p_return->>'followUpNotes', ''),
    coalesce(p_return->>'notes', ''),
    coalesce(p_return->>'status', 'Closed'),
    coalesce(p_return->>'processedBy', ''),
    coalesce(p_return->>'conversationLink', '')
  ) returning id into v_return_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into return_items (
      return_id, product, condition, decision, refund_amount, restocking_fee
    ) values (
      v_return_id,
      coalesce(v_item->>'product', ''),
      coalesce(v_item->>'condition', 'Sealed'),
      coalesce(v_item->>'decision', 'Pending'),
      coalesce((v_item->>'refundAmount')::numeric, 0),
      coalesce((v_item->>'restockingFee')::numeric, 0)
    );
  end loop;

  if p_close_refunds then
    with closed as (
      update refund_requests
      set status = 'Processed',
          processed_notes = 'Auto-closed — linked return was processed.',
          processed_at = now()
      where order_number = p_return->>'orderNumber'
        and status = 'Pending'
      returning id
    )
    select coalesce(array_agg(id), '{}') into v_closed_refund_ids from closed;
  end if;

  return jsonb_build_object(
    'returnId', v_return_id,
    'closedRefundIds', to_jsonb(v_closed_refund_ids)
  );
end;
$$;

create or replace function update_return_with_items(
  p_return_id uuid,
  p_header jsonb,
  p_items jsonb default null,
  p_replace_items boolean default false,
  p_close_refunds boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_order_number text;
  v_closed_refund_ids uuid[] := '{}';
begin
  update returns set
    order_number = case when p_header ? 'orderNumber' then p_header->>'orderNumber' else order_number end,
    customer_name = case when p_header ? 'customerName' then p_header->>'customerName' else customer_name end,
    customer_email = case when p_header ? 'customerEmail' then coalesce(p_header->>'customerEmail', '') else customer_email end,
    assigned_to = case when p_header ? 'assignedTo' then coalesce(p_header->>'assignedTo', '') else assigned_to end,
    follow_up_status = case when p_header ? 'followUpStatus' then p_header->>'followUpStatus' else follow_up_status end,
    follow_up_notes = case when p_header ? 'followUpNotes' then coalesce(p_header->>'followUpNotes', '') else follow_up_notes end,
    processed_by = case when p_header ? 'processedBy' then coalesce(p_header->>'processedBy', '') else processed_by end,
    conversation_link = case when p_header ? 'conversationLink' then coalesce(p_header->>'conversationLink', '') else conversation_link end,
    tracking_number = case when p_header ? 'trackingNumber' then coalesce(p_header->>'trackingNumber', '') else tracking_number end,
    parcel_received = case when p_header ? 'parcelReceived' then (p_header->>'parcelReceived')::boolean else parcel_received end,
    linked_request_id = case when p_header ? 'linkedRequestId' then nullif(p_header->>'linkedRequestId', '')::uuid else linked_request_id end,
    stage = case when p_header ? 'stage' then p_header->>'stage' else stage end,
    starshipit_order_number = case when p_header ? 'starshipitOrderNumber' then coalesce(p_header->>'starshipitOrderNumber', '') else starshipit_order_number end,
    notes = case when p_header ? 'notes' then coalesce(p_header->>'notes', '') else notes end,
    status = case when p_header ? 'status' then p_header->>'status' else status end,
    date = case when p_header ? 'date' then p_header->>'date' else date end
  where id = p_return_id
  returning order_number into v_order_number;

  if not found then raise exception 'Return % not found', p_return_id; end if;

  if p_replace_items then
    if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
      raise exception 'At least one return item is required';
    end if;
    delete from return_items where return_id = p_return_id;
    for v_item in select value from jsonb_array_elements(p_items)
    loop
      insert into return_items (
        return_id, product, condition, decision, refund_amount, restocking_fee
      ) values (
        p_return_id,
        coalesce(v_item->>'product', ''),
        coalesce(v_item->>'condition', 'Sealed'),
        coalesce(v_item->>'decision', 'Pending'),
        coalesce((v_item->>'refundAmount')::numeric, 0),
        coalesce((v_item->>'restockingFee')::numeric, 0)
      );
    end loop;
  end if;

  if p_close_refunds then
    with closed as (
      update refund_requests
      set status = 'Processed',
          processed_notes = 'Auto-closed — linked return was processed.',
          processed_at = now()
      where order_number = v_order_number and status = 'Pending'
      returning id
    )
    select coalesce(array_agg(id), '{}') into v_closed_refund_ids from closed;
  end if;

  return jsonb_build_object(
    'returnId', p_return_id,
    'closedRefundIds', to_jsonb(v_closed_refund_ids)
  );
end;
$$;

create or replace function finalize_replenishment_dispatch(
  p_request_id uuid,
  p_dispatch_source text,
  p_tracking text,
  p_dispatch_date date,
  p_item_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request replenishment_requests%rowtype;
  v_item jsonb;
  v_has_storeroom boolean;
  v_has_tpl boolean;
  v_storeroom_done boolean;
  v_tpl_done boolean;
  v_all_done boolean;
begin
  select * into v_request from replenishment_requests where id = p_request_id for update;
  if not found then raise exception 'Replenishment request % not found', p_request_id; end if;

  if p_dispatch_source = 'Storeroom' and v_request.storeroom_dispatched then
    return jsonb_build_object('alreadyDispatched', true, 'status', v_request.status);
  end if;
  if p_dispatch_source = '3PL' and v_request.tpl_dispatched then
    return jsonb_build_object('alreadyDispatched', true, 'status', v_request.status);
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_item_updates, '[]'::jsonb))
  loop
    update replenishment_items set
      quantity_sent = coalesce((v_item->>'quantitySent')::integer, 0),
      source = coalesce(v_item->>'source', source),
      skipped = coalesce((v_item->>'skipped')::boolean, false)
    where id = (v_item->>'id')::uuid and request_id = p_request_id;
    if not found then raise exception 'Invalid replenishment item %', v_item->>'id'; end if;
  end loop;

  select
    bool_or(not skipped and source = 'Storeroom'),
    bool_or(not skipped and source = '3PL')
  into v_has_storeroom, v_has_tpl
  from replenishment_items where request_id = p_request_id;

  v_storeroom_done := v_request.storeroom_dispatched or p_dispatch_source in ('Storeroom', 'All');
  v_tpl_done := v_request.tpl_dispatched or p_dispatch_source in ('3PL', 'All');
  v_all_done := (not coalesce(v_has_storeroom, false) or v_storeroom_done)
                and (not coalesce(v_has_tpl, false) or v_tpl_done);

  update replenishment_requests set
    storeroom_dispatched = v_storeroom_done,
    storeroom_tracking = case when p_dispatch_source in ('Storeroom', 'All') then coalesce(p_tracking, '') else storeroom_tracking end,
    storeroom_dispatch_date = case when p_dispatch_source in ('Storeroom', 'All') then p_dispatch_date else storeroom_dispatch_date end,
    tpl_dispatched = v_tpl_done,
    tpl_tracking = case when p_dispatch_source in ('3PL', 'All') then coalesce(p_tracking, '') else tpl_tracking end,
    tpl_dispatch_date = case when p_dispatch_source in ('3PL', 'All') then p_dispatch_date else tpl_dispatch_date end,
    status = case when v_all_done then 'Dispatched' else 'Partially Dispatched' end,
    tracking_number = case when v_all_done then coalesce(p_tracking, '') else tracking_number end,
    dispatch_date = case when v_all_done then p_dispatch_date else dispatch_date end
  where id = p_request_id;

  return jsonb_build_object(
    'alreadyDispatched', false,
    'status', case when v_all_done then 'Dispatched' else 'Partially Dispatched' end
  );
end;
$$;

revoke all on function create_return_with_items(jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function update_return_with_items(uuid, jsonb, jsonb, boolean, boolean) from public, anon, authenticated;
revoke all on function finalize_replenishment_dispatch(uuid, text, text, date, jsonb) from public, anon, authenticated;
grant execute on function create_return_with_items(jsonb, jsonb, boolean) to service_role;
grant execute on function update_return_with_items(uuid, jsonb, jsonb, boolean, boolean) to service_role;
grant execute on function finalize_replenishment_dispatch(uuid, text, text, date, jsonb) to service_role;
