import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const DEFAULTS = { reservation_mode: 1, default_interval_min: 15, default_buffer_min: 5 };

export async function GET() {
  const supa = getServiceClient();
  const { data, error } = await supa.from('settings').select('*').eq('id', 'global').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = data ?? (await supa.from('settings').upsert({ id: 'global', ...DEFAULTS }).select('*').single()).data;
  return NextResponse.json({
    reservationMode: row?.reservation_mode ?? 1,
    defaultIntervalMin: row?.default_interval_min ?? 15,
    defaultBufferMin: row?.default_buffer_min ?? 5,
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const supa = getServiceClient();
  const patch: any = {};
  if (body.reservationMode != null) patch.reservation_mode = Number(body.reservationMode) === 2 ? 2 : 1;
  if (body.defaultIntervalMin != null) patch.default_interval_min = Math.max(1, Number(body.defaultIntervalMin) || 15);
  if (body.defaultBufferMin != null) patch.default_buffer_min = Math.max(0, Number(body.defaultBufferMin) || 5);

  const { data, error } = await supa.from('settings').upsert({ id: 'global', ...patch }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    reservationMode: data.reservation_mode,
    defaultIntervalMin: data.default_interval_min,
    defaultBufferMin: data.default_buffer_min,
  });
}
