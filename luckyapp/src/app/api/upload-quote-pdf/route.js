import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const BUCKET_NAME = 'quote-pdfs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const quoteNumber = formData.get('quoteNumber');

    if (!file || !quoteNumber) {
      return NextResponse.json({ error: 'Missing file or quoteNumber' }, { status: 400 });
    }

    // Create Supabase admin client (service role for storage operations)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Ensure bucket exists (idempotent — won't error if already created)
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
    });

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `quote-${quoteNumber}-${timestamp}.pdf`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload the PDF
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload-quote-pdf] Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    console.log('[upload-quote-pdf] ✓ Uploaded:', urlData.publicUrl);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
    });
  } catch (err) {
    console.error('[upload-quote-pdf] Error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
