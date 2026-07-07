import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(email|name|order|product)\}/g, (_match, key: string) => (
    encodeURIComponent(values[key] ?? '')
  ));
}

function commslayerConversationsUrl(): string {
  const baseUrl = process.env.COMMSLAYER_BASE_URL?.trim().replace(/\/api\/integration\/v1\/?$/, '').replace(/\/$/, '');
  const accountId = process.env.COMMSLAYER_ACCOUNT_ID?.trim();
  if (baseUrl && accountId) return `${baseUrl}/app/accounts/${accountId}/conversations`;
  return 'https://app.commslayer.com';
}

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const values = {
    email: searchParams.get('email')?.trim() ?? '',
    name: searchParams.get('name')?.trim() ?? '',
    order: searchParams.get('order')?.trim() ?? '',
    product: searchParams.get('product')?.trim() ?? '',
  };

  if (!values.email) {
    return NextResponse.json({ error: 'Customer email is required' }, { status: 400 });
  }

  const template = process.env.COMMSLAYER_EMAIL_COMPOSE_URL_TEMPLATE?.trim();
  const location = template ? fillTemplate(template, values) : commslayerConversationsUrl();

  return NextResponse.redirect(location);
}
