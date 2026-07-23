import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase-admin";

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

    const supabase = createAdmin();
    const { error } = await supabase
      .from("submissions")
      .update({
        data: newData,
        notes: notes || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", id: Number(id), saved: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
