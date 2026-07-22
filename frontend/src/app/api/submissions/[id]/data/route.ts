import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data: newData, notes } = body;

    if (!newData || typeof newData !== "object") {
      return NextResponse.json(
        { error: "Champ 'data' requis (objet)" },
        { status: 400 }
      );
    }

    // Essayer Supabase d'abord
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const { createAdmin } = await import("@/lib/supabase-admin");
        const supabase = createAdmin();
        const { error } = await supabase
          .from("submissions")
          .update({
            data: newData,
            notes: notes || "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", Number(id));

        if (!error) {
          return NextResponse.json({ status: "ok", id: Number(id), saved: true });
        }
      } catch {
        // Fallback
      }
    }

    // Fallback: db.json
    const DB_PATH = path.resolve(process.cwd(), "..", "backend", "db.json");
    if (fs.existsSync(DB_PATH)) {
      const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      for (const formUid of Object.keys(db.submissions)) {
        const subs = db.submissions[formUid];
        const idx = subs.findIndex((s: any) => String(s.id) === String(id));
        if (idx !== -1) {
          subs[idx].data = newData;
          subs[idx].notes = notes || subs[idx].notes || "";
          fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
          return NextResponse.json({ status: "ok", id: Number(id), saved: true });
        }
      }
    }

    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
