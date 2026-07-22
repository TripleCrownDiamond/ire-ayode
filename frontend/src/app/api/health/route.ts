import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    kobo: !!process.env.KOBO_API_TOKEN,
  });
}
