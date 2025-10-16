export const runtime = 'nodejs';
export const preferredRegion = 'fra1';

import { NextResponse } from 'next/server';
import { planCleanup } from '@/lib/blob-cleanup';
import { getAnonClient } from '@/lib/supabase'; // <- čítať z tvojho existujúceho modulu

/**
 * Jeden cron job (Hobby limit):
 * - KAŽDÝ beh spraví keep-alive ping na Supabase (aby sa projekt/DB neuspával).
 * - LEN ak je nedeľa 03:00 UTC, urobí aj týždenný cleanup blobov.
 */

function isSunday0300UTC(d = new Date()) {
  const utcDay = d.getUTCDay();    // 0 = Sunday
  const utcHour = d.getUTCHours(); // 0..23
  return utcDay === 0 && utcHour === 3;
}

async function keepAlive() {
  // drobný SELECT – stačí, aby mal Supabase aktivitu
  const supa = getAnonClient();
  // prispôsob si názov tabuľky, ak by 'site_settings' u teba neexistovala:
  await supa.from('site_settings').select('id').limit(1);
}

export async function GET(req: Request) {
  const now = new Date();
  const origin = new URL(req.url).origin;

  try {
    // 1) vždy pingni DB, aby „žila“
    await keepAlive();

    // 2) týždenný cleanup len v nedeľu 03:00 UTC
    let didCleanup = false;
    let report: any = null;
    if (isSunday0300UTC(now)) {
      report = await planCleanup({
        origin,
        daysOld: 30,        // zmaž staršie ako 30 dní
        keepRecentJson: 20, // nechaj 20 najnovších JSON snapshotov
        dryRun: false       // reálny cleanup
      });
      didCleanup = true;
    }

    return NextResponse.json({
      ok: true,
      at: now.toISOString(),
      keepAlive: true,
      didCleanup,
      report
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'cron failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // voliteľný manuálny trigger s tokenom
  const token = process.env.CLEANUP_TOKEN;
  if (!token) return NextResponse.json({ error: 'Missing CLEANUP_TOKEN' }, { status: 500 });

  let body: any = {};
  try { body = await req.json(); } catch {}

  if (body?.token !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(req.url).origin;

  try {
    // manuálne: vždy sprav keep-alive
    await keepAlive();

    // manuálne môžeš vynútiť cleanup
    const daysOld = Number(body?.daysOld ?? 30);
    const keepRecentJson = Number(body?.keepRecentJson ?? 20);
    const dryRun = body?.dryRun === true;
    const runCleanup = body?.runCleanup === true;

    const report = runCleanup
      ? await planCleanup({ origin, daysOld, keepRecentJson, dryRun })
      : null;

    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      keepAlive: true,
      ranCleanup: runCleanup,
      report
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'manual cleanup failed' },
      { status: 500 }
    );
  }
}
