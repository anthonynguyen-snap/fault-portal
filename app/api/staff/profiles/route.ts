import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { hasAdminAccess, verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>) {
  return {
    id:              String(row.id ?? ''),
    staffId:         String(row.staff_id ?? ''),
    staffName:       String(row.staff_name ?? ''),
    shippingAddress: String(row.shipping_address ?? ''),
    phone:           String(row.phone ?? ''),
    personalEmail:   String(row.personal_email ?? ''),
    contractLink:    String(row.contract_link ?? ''),
    startDate:       row.start_date ? String(row.start_date) : '',
    notes:           String(row.notes ?? ''),
    updatedAt:       String(row.updated_at ?? ''),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = String(record.message ?? record.details ?? record.hint ?? '');
    if (message) {
      if (message.includes('staff_profiles') || message.includes('relation')) {
        return 'Staff profiles table is missing. Apply the Supabase migration 20260521_staff_profiles.sql, then try again.';
      }
      return message;
    }
  }
  return String(error);
}

async function requireAdmin() {
  const session = await verifySession();
  return hasAdminAccess(session?.role);
}

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await getSupabase()
      .from('staff_profiles')
      .select('*')
      .order('staff_name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const staffId = String(body.staffId ?? '').trim();
    const staffName = String(body.staffName ?? '').trim();

    if (!staffId) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    if (!staffName) return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });

    const { data, error } = await getSupabase()
      .from('staff_profiles')
      .upsert({
        staff_id:          staffId,
        staff_name:        staffName,
        shipping_address:  String(body.shippingAddress ?? '').trim(),
        phone:             String(body.phone ?? '').trim(),
        personal_email:    String(body.personalEmail ?? '').trim(),
        contract_link:     String(body.contractLink ?? '').trim(),
        start_date:        body.startDate ? String(body.startDate) : null,
        notes:             String(body.notes ?? '').trim(),
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'staff_id' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
