import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';

const BUCKET_NAME = 'quote-pdfs';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request) {
  try {
    // ── Auth gate: any authenticated team member can upload, but the file
    //    must land under their org's prefix. Pre-auth uploads are forbidden.
    const auth = await authenticateRequest(request);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file');
    const quoteNumber = formData.get('quoteNumber');
    const quoteId = formData.get('quoteId');

    if (!file || !quoteNumber) {
      return NextResponse.json({ error: 'Missing file or quoteNumber' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 413 });
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only application/pdf is accepted' }, { status: 415 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // If a quoteId is provided, verify it belongs to the caller's org before
    // accepting an upload tagged with its quoteNumber.
    if (quoteId) {
      const { data: q } = await supabase
        .from('quotes')
        .select('id, org_id, quote_number')
        .eq('id', quoteId)
        .maybeSingle();
      if (!q || q.org_id !== auth.orgId) {
        return NextResponse.json({ error: 'Quote not found in your org' }, { status: 404 });
      }
    }

    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    });

    // Sanitize quoteNumber to prevent path traversal and scope by orgId.
    const safeQuote = String(quoteNumber).replace(/[^a-zA-Z0-9_-]/g, '');
    const timestamp = Date.now();
    const fileName = `${auth.orgId}/quote-${safeQuote}-${timestamp}.pdf`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload-quote-pdf] Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
    });
  } catch (err) {
    console.error('[upload-quote-pdf] Error:', err.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
