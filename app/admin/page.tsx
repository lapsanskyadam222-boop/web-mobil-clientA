import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { z } from 'zod';

const ThemeSchema = z.union([
  z.object({ mode: z.literal('light') }),
  z.object({ mode: z.literal('dark') }),
  z.object({
    mode: z.literal('custom'),
    bgColor: z.string(),
    textColor: z.string(),
  }),
]);

const Schema = z.object({
  logoUrl: z.string().url().nullable(),
  carousel: z.array(z.string().url()).min(0).max(10),
  text: z.string().max(5000),
  theme: ThemeSchema.optional(),
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

    const key = `site-content-${Date.now()}.json`;

    const res = await put(key, JSON.stringify(payload, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
    });

    return NextResponse.json({ ok: true, url: res.url, key });
  } catch {
    return NextResponse.json({ error: 'Ukladanie zlyhalo' }, { status: 500 });
  }
}
