import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const supa = getServiceClient();
  const { data, error } = await supa.from('services').select('*').order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body?.name || '').trim();
  const duration = Math.max(1, Number(body?.durationMin) || 0);
  if (!name || duration <= 0) return NextResponse.json({ error: 'Názov a durationMin sú povinné.' }, { status: 400 });

  const supa = getServiceClient();
  const { data, error } = await supa.from('services').insert({ name, duration_min: duration }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ service: data });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const supa = getServiceClient();
  const { error } = await supa.from('services').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
