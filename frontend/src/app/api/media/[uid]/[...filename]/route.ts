import { NextResponse, type NextRequest } from "next/server";

const KOBO_TOKEN = process.env.KOBO_API_TOKEN || "";
const KOBO_KF_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; filename: string[] }> }
) {
  try {
    const { uid, filename: filenameParts } = await params;

    // ?url= proxy: pour les attachments de soumission (kc.kobotoolbox.org)
    const proxyUrl = request.nextUrl.searchParams.get("url");
    if (proxyUrl) {
      const resp = await fetch(proxyUrl, {
        headers: KOBO_TOKEN ? { Authorization: `Token ${KOBO_TOKEN}` } : {},
      });

      if (!resp.ok) {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
      }

      const buffer = await resp.arrayBuffer();
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          "Content-Type": resp.headers.get("content-type") || "application/octet-stream",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }

    // Fallback: form media via kf.kobotoolbox.org
    const filePath = filenameParts.join("/");
    const resp = await fetch(
      `${KOBO_KF_URL}/api/v2/assets/${uid}/media/${filePath}`,
      { headers: { Authorization: `Token ${KOBO_TOKEN}` } }
    );

    if (!resp.ok) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const buffer = await resp.arrayBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": resp.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
