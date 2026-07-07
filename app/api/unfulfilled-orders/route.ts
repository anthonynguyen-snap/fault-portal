import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { InternalNote, UnfulfilledOrder } from '@/types';

export const runtime = 'nodejs';

const OUTCOMES = new Set([
  'Waiting for stock',
  'Split fulfilment',
  'Cancelled',
  'Colour swap',
  'Alternative product',
  'Other',
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Unknown database error');
  }
  return String(error);
}

function fromRow(row: Record<string, unknown>): UnfulfilledOrder {
  return {
    id: String(row.id ?? ''),
    orderNumber: String(row.order_number ?? ''),
    customerName: String(row.customer_name ?? ''),
    customerEmail: String(row.customer_email ?? ''),
    productVariant: String(row.product_variant ?? ''),
    assignedTo: String(row.assigned_to ?? ''),
    contactedAt: row.contacted_at ? String(row.contacted_at) : null,
    contactedBy: String(row.contacted_by ?? ''),
    followUpRequired: Boolean(row.follow_up_required),
    followUpOn: row.follow_up_on ? String(row.follow_up_on) : null,
    outcome: (row.outcome as UnfulfilledOrder['outcome']) ?? 'Waiting for stock',
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolvedBy: String(row.resolved_by ?? ''),
    internalNotes: Array.isArray(row.internal_notes) ? row.internal_notes as InternalNote[] : [],
    source: String(row.source ?? 'Manual import'),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

async function requireSession() {
  const session = await verifySession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export async function GET() {
  try {
    await requireSession();
    const { data, error } = await getSupabase()
      .from('unfulfilled_orders')
      .select('*')
      .order('resolved_at', { ascending: true, nullsFirst: true })
      .order('follow_up_on', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ orders: (data ?? []).map(fromRow) });
  } catch (error) {
    const message = errorMessage(error);
    console.error('[GET /api/unfulfilled-orders]', { message, error });
    return NextResponse.json(
      { error: message === 'UNAUTHORIZED' ? 'Unauthorized' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const orders = Array.isArray(body.orders) ? body.orders : [];
    if (orders.length === 0) {
      return NextResponse.json({ error: 'At least one order is required' }, { status: 400 });
    }
    if (orders.length > 500) {
      return NextResponse.json({ error: 'Import is limited to 500 orders at a time' }, { status: 400 });
    }

    const rows = orders.map((order: Record<string, unknown>) => ({
      order_number: String(order.orderNumber ?? '').trim(),
      customer_name: String(order.customerName ?? '').trim(),
      customer_email: String(order.customerEmail ?? '').trim(),
      product_variant: String(order.productVariant ?? '').trim(),
      source: 'Manual import',
      updated_at: new Date().toISOString(),
    }));
    const invalid = rows.find((row: {
      order_number: string;
      customer_name: string;
      customer_email: string;
    }) => !row.order_number || !row.customer_name || !row.customer_email);
    if (invalid) {
      return NextResponse.json(
        { error: 'Every row needs an order number, customer name and email' },
        { status: 400 },
      );
    }

    const rowsByOrderNumber = new Map<string, typeof rows[number]>();
    for (const row of rows) {
      rowsByOrderNumber.set(row.order_number, row);
    }
    const dedupedRows = Array.from(rowsByOrderNumber.values());

    const { data, error } = await getSupabase()
      .from('unfulfilled_orders')
      .upsert(dedupedRows, { onConflict: 'order_number' })
      .select('*');
    if (error) throw error;
    return NextResponse.json(
      {
        orders: (data ?? []).map(fromRow),
        imported: dedupedRows.length,
        skippedDuplicates: rows.length - dedupedRows.length,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = errorMessage(error);
    console.error('[POST /api/unfulfilled-orders]', { message, error });
    return NextResponse.json(
      { error: message === 'UNAUTHORIZED' ? 'Unauthorized' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const id = String(body.id ?? '');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.contacted === 'boolean') {
      update.contacted_at = body.contacted ? new Date().toISOString() : null;
      update.contacted_by = body.contacted ? session.name : '';
    }
    if (typeof body.followUpRequired === 'boolean') {
      update.follow_up_required = body.followUpRequired;
      if (!body.followUpRequired) update.follow_up_on = null;
    }
    if (body.followUpOn !== undefined) update.follow_up_on = body.followUpOn || null;
    if (body.assignedTo !== undefined) update.assigned_to = String(body.assignedTo ?? '').trim();
    if (body.outcome !== undefined) {
      if (!OUTCOMES.has(body.outcome)) {
        return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
      }
      update.outcome = body.outcome;
    }
    if (typeof body.resolved === 'boolean') {
      update.resolved_at = body.resolved ? new Date().toISOString() : null;
      update.resolved_by = body.resolved ? session.name : '';
    }

    if (typeof body.addNote === 'string' && body.addNote.trim()) {
      const { data: existing, error: fetchError } = await getSupabase()
        .from('unfulfilled_orders')
        .select('internal_notes')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;
      const notes: InternalNote[] = Array.isArray(existing.internal_notes) ? existing.internal_notes : [];
      update.internal_notes = [...notes, {
        id: `note-${Date.now()}`,
        text: body.addNote.trim(),
        author: session.name,
        createdAt: new Date().toISOString(),
      }];
    }

    const { data, error } = await getSupabase()
      .from('unfulfilled_orders')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ order: fromRow(data) });
  } catch (error) {
    const message = errorMessage(error);
    console.error('[PATCH /api/unfulfilled-orders]', { message, error });
    return NextResponse.json(
      { error: message === 'UNAUTHORIZED' ? 'Unauthorized' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 500 },
    );
  }
}
