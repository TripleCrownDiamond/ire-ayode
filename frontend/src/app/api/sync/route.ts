import { NextResponse } from "next/server";
import { syncAllForms } from "@/lib/data";

export async function POST() {
  try {
    const result = await syncAllForms();

    return NextResponse.json({
      status: "success",
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
