import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const BUCKET = 'product-images';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed.' }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 4MB.' }, { status: 400 });
    }

    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `launches/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const supabase = getSupabase();

    // Ensure bucket exists (create if not)
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ data: { url: publicUrl } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
