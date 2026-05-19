import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { Shipment, ShipmentItem } from '@/types';

export const runtime = 'nodejs';

function fromItemRow(row: Record<string, unknown>): ShipmentItem {
  return {
    id:          String(row.id ?? ''),
    shipmentId:  String(row.shipment_id ?? ''),
    productName: String(row.product_name ?? ''),
    sku:         String(row.sku ?? ''),
    quantity:    Number(row.quantity ?? 0),
    notes:       String(row.notes ?? ''),
  };
}

function fromRow(row: Record<string, unknown>): Shipment {
  const rawItems = Array.isArray(row.shipment_items) ? row.shipment_items : [];
  return {
    id:                   String(row.id ?? ''),
    shipmentNumber:       String(row.shipment_number ?? ''),
    location:             String(row.location ?? ''),
    transportType:        (row.transport_type as Shipment['transportType']) ?? 'Sea',
    provider:             String(row.provider ?? ''),
    trackingNumber:       String(row.tracking_number ?? ''),
    eta:                  (row.eta as string | null) ?? null,
    status:               (row.status as Shipment['status']) ?? 'Pending',
    costUsd:              Number(row.cost_usd ?? 0),
    costAud:              Number(row.cost_aud ?? 0),
    cartons:              String(row.cartons ?? ''),
    weightKg:             String(row.weight_kg ?? ''),
    branchTransferNumber: String(row.branch_transfer_number ?? ''),
    asnNumber:            String(row.asn_number ?? ''),
    notes:                String(row.notes ?? ''),
    items:                rawItems.map(fromItemRow),
    createdAt:            String(row.created_at ?? ''),
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { items, ...fields } = body;

    const map: Record<string, string> = {
      shipmentNumber:       'shipment_number',
      location:             'location',
      transportType:        'transport_type',
      provider:             'provider',
      trackingNumber:       'tracking_number',
      eta:                  'eta',
      status:               'status',
      costUsd:              'cost_usd',
      costAud:              'cost_aud',
      cartons:              'cartons',
      weightKg:             'weight_kg',
      branchTransferNumber: 'branch_transfer_number',
      asnNumber:            'asn_number',
      notes:                'notes',
    };

    const updates: Record<string, unknown> = {};
    for (const [camel, snake] of Object.entries(map)) {
      if (camel in fields) {
        updates[snake] = camel === 'eta' ? (fields[camel] || null) : (fields[camel] ?? null);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await getSupabase().from('shipments').update(updates).eq('id', id);
      if (error) throw error;
    }

    // Replace items if provided
    if (Array.isArray(items)) {
      await getSupabase().from('shipment_items').delete().eq('shipment_id', id);
      if (items.length > 0) {
        const itemRows = items.map((item: Partial<ShipmentItem>) => ({
          shipment_id:  id,
          product_name: item.productName ?? '',
          sku:          item.sku ?? '',
          quantity:     item.quantity ?? 0,
          notes:        item.notes ?? '',
        }));
        const { error: itemErr } = await getSupabase().from('shipment_items').insert(itemRows);
        if (itemErr) throw itemErr;
      }
    }

    const { data: full } = await getSupabase()
      .from('shipments')
      .select('*, shipment_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ data: fromRow(full!) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabase().from('shipments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
