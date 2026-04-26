import { NextRequest, NextResponse } from 'next/server';
import { getStaff, createStaff, deleteStaff } from '@/lib/google-sheets';

export async function GET() {
  try {
    const staff = await getStaff();
    return NextResponse.json({ data: staff });
  } catch (error) {
    console.error('[GET /api/staff]', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const member = await createStaff(name);
    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/staff]', error);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await deleteStaff(id);
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('[DELETE /api/staff]', error);
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
