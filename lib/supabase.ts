import 'server-only';
import { createClient } from '@supabase/supabase-js';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SRV  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// anonymný klient (len na čítanie)
export function getAnonClient() {
  if (!URL || !ANON) throw new Error('Supabase env ANON chýba');
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

// serverový klient (používa service role key, vie zapisovať)
export function getServiceClient() {
  if (!URL || !SRV) throw new Error('Supabase env SERVICE ROLE chýba');
  return createClient(URL, SRV, { auth: { persistSession: false } });
}
