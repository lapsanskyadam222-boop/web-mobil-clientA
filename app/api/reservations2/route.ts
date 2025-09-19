import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { computeStartsForService } from '@/lib/slots';

// (voliteľne – rovnaké overenie ako máš v /api/reservations)
type VerifyResp = { success: boolean; 'error-codes'?: string[] };
async function verifyTurnstile(token?: string, remoteIp?: string) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return { ok: true }; // ak nemáš secret, nerob verifikáciu
  if (!token)  return { ok: false };
  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const json = (await r.json()) as VerifyResp;
  return { ok: !!json.success };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, start, serviceId, name, email, phone, hp, cfToken } = body ?? {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(start || '') || !serviceId) {
      return NextResponse.json({ error: 'Chýba date/start/serviceId' }, { status: 400 });
    }
    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Chýba meno, email alebo telefón' }, { status: 400 });
    }
    if (hp && String(hp).trim().length > 0) {
      return NextResponse.json({ error: 'Spam (honeypot)' }, { status: 400 });
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const turn = await verifyTurnstile(cfToken, ip);
    if (!turn.ok) return NextResponse.json({ error: 'Overenie zlyhalo' }, { status: 400 });

    const supa = getServiceClient();

    // načítaj plán + službu
    const { data: svc } = await supa.from('services').select('*').eq('id', serviceId).maybeSingle();
    if (!svc || !svc.is_active) return NextResponse.json({ error: 'Neplatná služba' }, { status: 400 });

    const { data: plan } = await supa.from('work_plans').select('*').eq('date', date).maybeSingle();
    const { data: settings } = await supa.from('settings').select('*').eq('id', 'global').maybeSingle();
    const windows = Array.isArray(plan?.windows) ? plan!.windows : [];
    const intervalMin = plan?.interval_min ?? settings?.default_interval_min ?? 15;
    const bufferMin   = plan?.buffer_min   ?? settings?.default_buffer_min   ?? 5;

    // ešte raz over dostupnosť v čase s bufferom
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

    if (!starts.includes(start)) {
      return NextResponse.json({ error: 'Termín už nie je dostupný' }, { status: 409 });
    }

    // vlož rezerváciu
    const [h, m] = String(start).split(':').map(Number);
    const endMinutes = h * 60 + m + Number(svc.duration_min);
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    const { data: inserted, error } = await supa
      .from('reservations2')
      .insert({
        date,
        start,
        end,
        service_id: serviceId,
        name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // (voliteľne) pošli email – môžeš recyklovať tvoju utilitu sendReservationEmail
    // await sendReservationEmail?.(...)

    return NextResponse.json({ ok: true, reservation: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Neznáma chyba' }, { status: 500 });
  }
}
