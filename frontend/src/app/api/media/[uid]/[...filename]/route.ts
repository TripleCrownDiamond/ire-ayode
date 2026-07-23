import { NextResponse, type NextRequest } from "next/server";

const KOBO_TOKEN = process.env.KOBO_API_TOKEN || "";
const KOBO_KF_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");
const KOBO_KC_URL = KOBO_KF_URL.replace("kf.kobotoolbox.org", "kc.kobotoolbox.org");

function resolveUrl(url: string): string {
  // If already absolute, return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // If relative path, resolve against kc server (data server hosts attachments)
  return `${KOBO_KC_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; filename: string[] }> }
) {
  try {
    const { uid, filename: filenameParts } = await params;

    // ?url= proxy: pour les attachments de soumission
    const proxyUrl = request.nextUrl.searchParams.get("url");
    if (proxyUrl) {
      const resolvedUrl = resolveUrl(proxyUrl);
      const headers: Record<string, string> = {};
      if (KOBO_TOKEN) headers.Authorization = `Token ${KOBO_TOKEN}`;

      const resp = await fetch(resolvedUrl, { headers });

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
