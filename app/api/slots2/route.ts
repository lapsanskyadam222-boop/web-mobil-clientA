import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { computeStartsForService } from '@/lib/slots';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const serviceId = searchParams.get('serviceId') || '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    return NextResponse.json({ error: 'Missing date or serviceId' }, { status: 400 });
  }

  const supa = getServiceClient();

  const { data: svc, error: e1 } = await supa.from('services').select('*').eq('id', serviceId).maybeSingle();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!svc || !svc.is_active) return NextResponse.json({ starts: [] });

  const { data: plan } = await supa.from('work_plans').select('*').eq('date', date).maybeSingle();
  const { data: settings } = await supa.from('settings').select('*').eq('id', 'global').maybeSingle();

  const windows = Array.isArray(plan?.windows) ? plan!.windows : [];
  const intervalMin = plan?.interval_min ?? settings?.default_interval_min ?? 15;
  const bufferMin   = plan?.buffer_min   ?? settings?.default_buffer_min   ?? 5;

  const { data: existing } = await supa
    .from('reservations2')
    .select('start, end')
    .eq('date', date);

  const starts = computeStartsForService({
    windows,
    intervalMin,
    bufferMin,
    durationMin: Number(svc.duration_min),
    reservations: (existing ?? []).map(r => ({ start: r.start as string, end: r.end as string })),
  });

  return NextResponse.json({ starts });
}
