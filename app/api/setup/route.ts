import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('key') !== 'snapcc2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

    const sql = `
      create table if not exists return_items (
        id uuid primary key default gen_random_uuid(),
        return_id uuid not null references returns(id) on delete cascade,
        product text not null default '',
        condition text not null default 'Sealed',
        decision text not null default 'Pending',
        refund_amount numeric default 0,
        restocking_fee numeric default 0,
        created_at timestamptz default now()
      );
    `;

    // Use Supabase pg_meta API which is available to service role
    const res = await fetch(`${url}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    // Fallback: try the pg_meta endpoint
    if (!res.ok) {
      const res2 = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
      const data2 = await res2.json();
      return NextResponse.json({ method: 'management-api', status: res2.status, data: data2 });
    }

    const data = await res.json();
    return NextResponse.json({ method: 'rpc', status: res.status, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
