import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { z } from 'zod';

const Schema = z.object({
  logoUrl: z.string().url().nullable(),
  carousel: z.array(z.string().url()).min(1).max(10),
  text: z.string().max(5000)
});

export async function POST(req: Request) {
  try {
    // Nutné env premenné
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Chýba BLOB_READ_WRITE_TOKEN' }, { status: 500 });
    }

    // Validácia payloadu
    const json = await req.json();
    const parsed = Schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatné dáta' }, { status: 400 });
    }

    // Uloženie do JSON
    const payload = {
      ...parsed.data,
      updatedAt: new Date().toISOString()
    };

    const res = await put(
      'site-content.json',
      JSON.stringify(payload, null, 2),
      {
        access: 'public',
        contentType: 'application/json'
      }
    );

    return NextResponse.json({ ok: true, url: res.url });
  } catch (e) {
    return NextResponse.json({ error: 'Ukladanie zlyhalo' }, { status: 500 });
  }
}
