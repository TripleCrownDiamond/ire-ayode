import { NextResponse } from "next/server";
import { KoboClient } from "@/lib/kobo";

const kobo = new KoboClient();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string; filename: string[] }> }
) {
  try {
    const { uid, filename } = await params;
    const filePath = filename.join("/");

    const { buffer, contentType } = await kobo.getMedia(uid, filePath);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
