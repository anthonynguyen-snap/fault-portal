import { NextRequest, NextResponse } from 'next/server';
import { getReturns, createReturn } from '@/lib/google-sheets';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const data = await getReturns();
    return NextResponse.json({ data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderNumber, customerName, customerEmail, product,
            condition, decision, restockingFee, assignedTo,
            notes, processedBy, date } = body;

    if (!orderNumber || !customerName || !product || !condition || !decision) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newReturn = await createReturn({
      date: date || new Date().toISOString().slice(0, 10),
      orderNumber,
      customerName,
      customerEmail: customerEmail || '',
      product,
      condition,
      decision,
      restockingFee: Number(restockingFee) || 0,
      assignedTo: assignedTo || '',
      followUpStatus: assignedTo ? 'Pending' : 'N/A',
      followUpNotes: '',
      notes: notes || '',
      status: 'Received',
      processedBy: processedBy || '',
    });

    return NextResponse.json({ data: newReturn }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
