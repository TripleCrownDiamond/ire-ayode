import { NextResponse } from "next/server";

export async function GET() {
  const koboToken = process.env.KOBO_API_TOKEN || "";
  const koboUrl = process.env.KOBO_API_URL || "https://kf.kobotoolbox.org";

  // Test Kobo connectivity
  let koboStatus = "not_configured";
  if (koboToken) {
    try {
      const resp = await fetch(`${koboUrl.replace(/\/$/, "")}/api/v2/assets.json?limit=1`, {
        headers: { Authorization: `Token ${koboToken}` },
      });
      koboStatus = resp.ok ? "connected" : `error_${resp.status}`;
    } catch {
      koboStatus = "network_error";
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.1.0",
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    kobo: {
      configured: !!koboToken,
      status: koboStatus,
    },
  });
}
