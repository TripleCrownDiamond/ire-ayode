import { NextResponse } from "next/server";
import { getSyncLogs } from "@/lib/data";

export async function GET() {
  try {
    const logs = await getSyncLogs(20);
    return NextResponse.json({ logs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
