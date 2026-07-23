import { NextResponse, type NextRequest } from "next/server";

const KOBO_TOKEN = process.env.KOBO_API_TOKEN || "";

// KoboToolbox uses two servers:
// - kf.kobotoolbox.org (form server) for forms/media
// - kc.kobotoolbox.org (data server) for submission attachments
const KOBO_KF_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");
const KOBO_KC_URL = KOBO_KF_URL.replace("kf.kobotoolbox.org", "kc.kobotoolbox.org");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; filename: string[] }> }
) {
  try {
    const { uid, filename: filenameParts } = await params;

    // Si un ?url= est fourni, proxyer directement depuis l'URL Kobo (attachment submission)
    const proxyUrl = request.nextUrl.searchParams.get("url");
    if (proxyUrl) {
      // Kobo attachment URLs are often publicly accessible, try without auth first
      let resp = await fetch(proxyUrl);

      // If that fails, try with auth token
      if (!resp.ok && KOBO_TOKEN) {
        resp = await fetch(proxyUrl, {
          headers: { Authorization: `Token ${KOBO_TOKEN}` },
        });
      }

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

    // Fallback: form media (images téléchargées dans le constructeur de formulaire)
    const filePath = filenameParts.join("/");

    // Try kf first, then kc
    let resp = await fetch(`${KOBO_KF_URL}/api/v2/assets/${uid}/media/${filePath}`, {
      headers: { Authorization: `Token ${KOBO_TOKEN}` },
    });

    if (!resp.ok) {
      resp = await fetch(`${KOBO_KC_URL}/api/v2/assets/${uid}/media/${filePath}`, {
        headers: { Authorization: `Token ${KOBO_TOKEN}` },
      });
    }

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
