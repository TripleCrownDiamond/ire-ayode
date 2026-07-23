import { NextResponse, type NextRequest } from "next/server";

const KOBO_TOKEN = process.env.KOBO_API_TOKEN || "";
const KOBO_KF_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");
const KOBO_KC_URL = KOBO_KF_URL.replace("kf.kobotoolbox.org", "kc.kobotoolbox.org");

function authHeaders(): Record<string, string> {
  return KOBO_TOKEN ? { Authorization: `Token ${KOBO_TOKEN}` } : {};
}

async function tryFetch(url: string): Promise<Response | null> {
  try {
    const resp = await fetch(url, { headers: authHeaders() });
    return resp.ok ? resp : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; filename: string[] }> }
) {
  try {
    const { uid, filename: filenameParts } = await params;
    const filePath = filenameParts.join("/");
    const basename = filePath.split("/").pop() || filePath;

    // ?url= proxy: explicit download URL from _attachments
    const proxyUrl = request.nextUrl.searchParams.get("url");
    if (proxyUrl) {
      const absoluteUrl = proxyUrl.startsWith("http")
        ? proxyUrl
        : `${KOBO_KC_URL}${proxyUrl.startsWith("/") ? "" : "/"}${proxyUrl}`;

      const resp = await fetch(absoluteUrl, { headers: authHeaders() });
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        return new NextResponse(Buffer.from(buffer), {
          headers: {
            "Content-Type": resp.headers.get("content-type") || "application/octet-stream",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      }
    }

    // Try multiple URL patterns to find the image
    const attempts = [
      // 1. Form media via kf API
      `${KOBO_KF_URL}/api/v2/assets/${uid}/media/${filePath}`,
      // 2. Submission attachment via kc (original)
      `${KOBO_KC_URL}/media/original/${filePath}`,
      // 3. Submission attachment via kc (basename)
      `${KOBO_KC_URL}/media/original/${basename}`,
      // 4. Direct kc path
      `${KOBO_KC_URL}/media/${filePath}`,
      // 5. Without auth on kc (some instances are public)
    ];

    for (const url of attempts) {
      const resp = await tryFetch(url);
      if (resp) {
        const buffer = await resp.arrayBuffer();
        return new NextResponse(Buffer.from(buffer), {
          headers: {
            "Content-Type": resp.headers.get("content-type") || "application/octet-stream",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      }
    }

    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
