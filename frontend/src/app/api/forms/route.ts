import { NextResponse } from "next/server";
import { getForms } from "@/lib/data";

export async function GET() {
  try {
    const data = await getForms();
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
