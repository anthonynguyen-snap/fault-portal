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

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('shipments')
      .select('*, shipment_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items = [], ...fields } = body;

    if (!fields.shipmentNumber?.trim()) {
      return NextResponse.json({ error: 'Shipment number is required' }, { status: 400 });
    }

    const { data: row, error } = await getSupabase()
      .from('shipments')
      .insert({
        shipment_number:       fields.shipmentNumber.trim(),
        location:              fields.location?.trim() ?? '',
        transport_type:        fields.transportType ?? 'Sea',
        provider:              fields.provider?.trim() ?? '',
        tracking_number:       fields.trackingNumber?.trim() ?? '',
        eta:                   fields.eta || null,
        status:                fields.status ?? 'Pending',
        cost_usd:              fields.costUsd ?? 0,
        cost_aud:              fields.costAud ?? 0,
        cartons:               fields.cartons?.trim() ?? '',
        weight_kg:             fields.weightKg?.trim() ?? '',
        branch_transfer_number: fields.branchTransferNumber?.trim() ?? '',
        asn_number:            fields.asnNumber?.trim() ?? '',
        notes:                 fields.notes?.trim() ?? '',
      })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const itemRows = items.map((item: Partial<ShipmentItem>) => ({
        shipment_id:  row.id,
        product_name: item.productName ?? '',
        sku:          item.sku ?? '',
        quantity:     item.quantity ?? 0,
        notes:        item.notes ?? '',
      }));
      const { error: itemErr } = await getSupabase().from('shipment_items').insert(itemRows);
      if (itemErr) throw itemErr;
    }

    const { data: full } = await getSupabase()
      .from('shipments')
      .select('*, shipment_items(*)')
      .eq('id', row.id)
      .single();

    return NextResponse.json({ data: fromRow(full!) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
