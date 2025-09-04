import { NextResponse } from "next/server";
import { getServiceClient, getAnonClient } from "@/lib/supabase";

type Slot = {
  id: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:mm
  locked?: boolean;
  capacity?: number;
  bookedCount?: number;
};

const TABLE = "slots";

/* GET – všetky sloty */
export async function GET() {
  try {
    const supabase = getAnonClient();
    const { data, error } = await supabase.from(TABLE).select("*").order("date").order("time");
    if (error) throw error;
    return NextResponse.json({ slots: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "GET slots error" }, { status: 500 });
  }
}

/* POST – pridanie slotov */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceClient();

    let toInsert: Slot[] = [];

    if (Array.isArray(body.slots)) {
      toInsert = body.slots;
    } else if (body.date && Array.isArray(body.times)) {
      toInsert = body.times.map((t: string) => ({
        id: `${body.date}_${t.replace(":", "")}`,
        date: body.date,
        time: t,
        capacity: body.capacity ?? 1,
        bookedCount: 0,
        locked: false,
      }));
    } else if (body.date && body.time) {
      toInsert = [{
        id: `${body.date}_${body.time.replace(":", "")}`,
        date: body.date,
        time: body.time,
        capacity: body.capacity ?? 1,
        bookedCount: 0,
        locked: false,
      }];
    }

    if (!toInsert.length) {
      return NextResponse.json({ error: "Chýbajú platné sloty" }, { status: 400 });
    }

    const { error } = await supabase.from(TABLE).upsert(toInsert, { onConflict: "id" });
    if (error) throw error;

    return NextResponse.json({ ok: true, created: toInsert });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "POST slots error" }, { status: 500 });
  }
}

/* PATCH – update (lock, unlock, delete, capacity) */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServiceClient();

    if (body.action === "delete") {
      await supabase.from(TABLE).delete().eq("id", body.id);
    } else if (body.action === "lock") {
      await supabase.from(TABLE).update({ locked: true }).eq("id", body.id);
    } else if (body.action === "unlock") {
      await supabase.from(TABLE).update({ locked: false }).eq("id", body.id);
    } else if (body.action === "capacity") {
      await supabase.from(TABLE).update({ capacity: body.capacity }).eq("id", body.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "PATCH slots error" }, { status: 500 });
  }
}

/* DELETE – wipe všetkých slotov */
export async function DELETE() {
  try {
    const supabase = getServiceClient();
    await supabase.from(TABLE).delete().neq("id", ""); // vymaže všetko
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "DELETE slots error" }, { status: 500 });
  }
}
