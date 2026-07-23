import { NextResponse, type NextRequest } from "next/server";
import { createAdmin } from "@/lib/supabase-admin";
import { getArchivedMedia } from "@/lib/media-archive";

const KOBO_TOKEN = process.env.KOBO_API_TOKEN || "";
const KOBO_KF_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");
const KOBO_KC_URL = KOBO_KF_URL.replace("kf.kobotoolbox.org", "kc.kobotoolbox.org");

function authHeaders(): Record<string, string> {
  return KOBO_TOKEN ? { Authorization: `Token ${KOBO_TOKEN}` } : {};
}

/** Résout une URL Kobo éventuellement relative en URL absolue. */
function absolutize(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${KOBO_KC_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** N'accepte que les hôtes Kobo — le paramètre ?url= vient du client. */
function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === new URL(KOBO_KF_URL).hostname ||
      host === new URL(KOBO_KC_URL).hostname ||
      /(^|\.)kobotoolbox\.org$/i.test(host)
    );
  } catch {
    return false;
  }
}

async function tryFetch(url: string): Promise<Response | null> {
  try {
    const resp = await fetch(url, { headers: authHeaders(), redirect: "follow" });
    if (!resp.ok) return null;
    // Kobo renvoie parfois une page HTML de login avec un statut 200
    const type = resp.headers.get("content-type") || "";
    if (/text\/html/i.test(type)) return null;
    return resp;
  } catch {
    return null;
  }
}

function serve(resp: Response, buffer: ArrayBuffer, filename: string) {
  const contentType =
    resp.headers.get("content-type") || guessContentType(filename) || "application/octet-stream";
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  avif: "image/avif",
  pdf: "application/pdf",
};

function guessContentType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string; filename: string[] }> }
) {
  try {
    const { uid, filename: filenameParts } = await params;
    const filePath = decodeURIComponent(filenameParts.join("/"));
    const basename = filePath.split("/").pop() || filePath;
    // Kobo remplace les espaces par des "_" à l'upload
    const sanitized = basename.replace(/\s+/g, "_");

    // 1. Copie locale archivée — servie en priorité.
    //    C'est ce qui permet à une image de rester visible après la suppression
    //    de la soumission sur KoboToolbox.
    const submissionId = Number(request.nextUrl.searchParams.get("sub")) || undefined;
    try {
      const archived = await getArchivedMedia(createAdmin(), uid, filePath, submissionId);
      if (archived) {
        return new NextResponse(Buffer.from(archived.body), {
          headers: {
            "Content-Type": archived.contentType,
            "Content-Length": String(archived.body.byteLength),
            "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable",
            "X-Media-Source": "archive",
          },
        });
      }
    } catch {
      // Archive indisponible (migration non appliquée, Storage HS) :
      // on retombe sur Kobo plutôt que d'échouer.
    }

    // 2. URL explicites issues des _attachments (plusieurs candidates possibles :
    //    original, medium, large — Kobo ne génère pas toujours les miniatures).
    const proxyUrls = request.nextUrl.searchParams
      .getAll("url")
      .map(absolutize)
      .filter(isAllowedHost);

    for (const url of proxyUrls) {
      const resp = await tryFetch(url);
      if (resp) return serve(resp, await resp.arrayBuffer(), filePath);
    }

    // 3. Repli : reconstruire les chemins Kobo usuels
    const attempts = [
      `${KOBO_KF_URL}/api/v2/assets/${uid}/media/${filePath}`,
      `${KOBO_KC_URL}/media/original?media_file=${encodeURIComponent(filePath)}`,
      `${KOBO_KC_URL}/media/original/${filePath}`,
      `${KOBO_KC_URL}/media/original/${sanitized}`,
      `${KOBO_KC_URL}/media/${filePath}`,
    ];

    for (const url of attempts) {
      const resp = await tryFetch(url);
      if (resp) return serve(resp, await resp.arrayBuffer(), filePath);
    }

    return NextResponse.json(
      { error: "Media not found", file: filePath, tried: proxyUrls.length + attempts.length },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Media not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
