import { NextRequest, NextResponse } from 'next/server';
import {
  getManufacturers,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
} from '@/lib/google-sheets';

export async function GET() {
  try {
    const manufacturers = await getManufacturers();
    return NextResponse.json({ data: manufacturers });
  } catch (error) {
    console.error('[GET /api/manufacturers]', error);
    return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Manufacturer name is required' }, { status: 400 });
    }
    const mfr = await createManufacturer({
      name:         body.name,
      contactEmail: body.contactEmail || '',
      phone:        body.phone || '',
      notes:        body.notes || '',
    });
    return NextResponse.json({ data: mfr }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/manufacturers]', error);
    return NextResponse.json({ error: 'Failed to create manufacturer' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Manufacturer ID required' }, { status: 400 });
    }
    await updateManufacturer(body.id, body);
    return NextResponse.json({ message: 'Updated' });
  } catch (error) {
    console.error('[PATCH /api/manufacturers]', error);
    return NextResponse.json({ error: 'Failed to update manufacturer' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Manufacturer ID required' }, { status: 400 });
    }
    await deleteManufacturer(id);
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('[DELETE /api/manufacturers]', error);
    return NextResponse.json({ error: 'Failed to delete manufacturer' }, { status: 500 });
  }
}
