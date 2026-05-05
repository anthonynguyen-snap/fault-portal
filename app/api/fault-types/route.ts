import { NextRequest, NextResponse } from 'next/server';
import {
  getFaultTypes,
  createFaultType,
  updateFaultType,
  deleteFaultType,
} from '@/lib/google-sheets';

export async function GET() {
  try {
    const faultTypes = await getFaultTypes();
    return NextResponse.json({ data: faultTypes });
  } catch (error) {
    console.error('[GET /api/fault-types]', error);
    return NextResponse.json({ error: 'Failed to fetch fault types' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Fault type name is required' }, { status: 400 });
    }
    const ft = await createFaultType({
      name:        body.name,
      description: body.description || '',
    });
    return NextResponse.json({ data: ft }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/fault-types]', error);
    return NextResponse.json({ error: 'Failed to create fault type' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Fault type ID required' }, { status: 400 });
    }
    await updateFaultType(body.id, body);
    return NextResponse.json({ message: 'Updated' });
  } catch (error) {
    console.error('[PATCH /api/fault-types]', error);
    return NextResponse.json({ error: 'Failed to update fault type' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Fault type ID required' }, { status: 400 });
    }
    await deleteFaultType(id);
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('[DELETE /api/fault-types]', error);
    return NextResponse.json({ error: 'Failed to delete fault type' }, { status: 500 });
  }
}
