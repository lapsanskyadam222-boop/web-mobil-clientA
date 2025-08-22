import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { z } from 'zod';

const Schema = z.object({
  logoUrl: z.string().url().nullable(),
  // dovoľ aj prázdny carousel (ak chceš vyžadovať aspoň 1, daj .min(1))
  carousel: z.array(z.string().url()).min(0).max(10),
  text: z.string().max(5000),
});

export async function POST(req: Request) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Chýba BLOB_READ_WRITE_TOKEN' }, { status: 500 });
    }

    const json = await req.json();
    const parsed = Schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neplatné dáta' }, { status: 400 });
    }

    const payload = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    // 🔴 kľúčová zmena: unikátne meno súboru
    const key = `site-content-${Date.now()}.json`;

    const res = await put(key, JSON.stringify(payload, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true, // ešte viac zaručí unikátne URL
    });

    return NextResponse.json({ ok: true, url: res.url, key });
  } catch {
    return NextResponse.json({ error: 'Ukladanie zlyhalo' }, { status: 500 });
  }
}
