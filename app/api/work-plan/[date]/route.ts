import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function isHHMM(v: any) { return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v); }

export async function GET(_: Request, { params }: { params: { date: string } }) {
  const supa = getServiceClient();
  const date = params.date; // "YYYY-MM-DD"
  const { data: settings } = await supa.from('settings').select('*').eq('id', 'global').maybeSingle();
  const { data } = await supa.from('work_plans').select('*').eq('date', date).maybeSingle();

  if (!data) {
    // default prázdny deň
    return NextResponse.json({
      date,
      windows: [],
      intervalMin: settings?.default_interval_min ?? 15,
      bufferMin: settings?.default_buffer_min ?? 5,
    });
  }

  return NextResponse.json({
    date,
    windows: Array.isArray(data.windows) ? data.windows : [],
    intervalMin: data.interval_min,
    bufferMin: data.buffer_min,
  });
}

export async function PUT(req: Request, { params }: { params: { date: string } }) {
  const date = params.date;
  const body = await req.json();

  const windows = Array.isArray(body?.windows) ? body.windows : [];
  const intervalMin = Math.max(1, Number(body?.intervalMin) || 15);
  const bufferMin = Math.max(0, Number(body?.bufferMin) || 5);

  // validácia okien (bez prekryvu)
  const cleaned = windows
    .filter((w: any) => isHHMM(w?.start) && isHHMM(w?.end) && w.start < w.end)
    .sort((a: any, b: any) => (a.start < b.start ? -1 : 1));

  for (let i = 1; i < cleaned.length; i++) {
    if (!(cleaned[i - 1].end <= cleaned[i].start)) {
      return NextResponse.json({ error: 'Pracovné okná sa prekrývajú.' }, { status: 400 });
    }
  }

  const supa = getServiceClient();
  const { data, error } = await supa
    .from('work_plans')
    .upsert({ date, windows: cleaned, interval_min: intervalMin, buffer_min: bufferMin, updated_at: new Date().toISOString() })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    date,
    windows: data.windows,
    intervalMin: data.interval_min,
    bufferMin: data.buffer_min,
  });
}
