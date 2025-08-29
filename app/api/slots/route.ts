// app/api/slots/route.ts
import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/blobJson';

type Slot = {
  id: string;
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM (24h)
  locked?: boolean;
  booked?: boolean;
};

type SlotsPayload = { slots: Slot[]; updatedAt: string };

const DEFAULT_SLOTS: SlotsPayload = {
  slots: [
    { id: '1', date: '2025-09-02', time: '17:00' },
    { id: '2', date: '2025-09-02', time: '19:00' },
    { id: '3', date: '2025-09-03', time: '18:00' },
    { id: '4', date: '2025-09-04', time: '17:30' },
  ],
  updatedAt: new Date().toISOString(),
};

const KEY = 'slots.json';

export async function GET() {
  const data = await readJson<SlotsPayload>(KEY, DEFAULT_SLOTS);
  if (data === DEFAULT_SLOTS) {
    await writeJson(KEY, DEFAULT_SLOTS);
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
