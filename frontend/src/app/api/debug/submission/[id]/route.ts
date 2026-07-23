import { NextResponse } from "next/server";
import { getSubmission } from "@/lib/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sub = await getSubmission(Number(id));
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const data = sub.data || {};
    const attachments = (data._attachments as any[]) || [];

    // Build attachment map same as submission page
    const attachmentMap = new Map<string, string>();
    for (const att of attachments) {
      const url = att.download_medium_url || att.download_large_url || att.download_url || "";
      if (url) {
        attachmentMap.set(att.filename, url);
        if (att.media_file_basename) {
          attachmentMap.set(att.media_file_basename, url);
        }
      }
    }

    // Find all image-like fields
    const imageFields: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_")) continue;
      if (typeof value !== "string") continue;
      const isImageByExt = /\.(jpg|jpeg|png|gif|webp|bmp)/i.test(value);
      const isImageByKey = /photo|signature|image|picture|img|camera|capture/i.test(key);
      if (isImageByExt || isImageByKey) {
        const basename = value.split("/").pop() || value;
        imageFields.push({
          key,
          value,
          isImageByExt,
          isImageByKey,
          basename,
          attachmentUrl: attachmentMap.get(value) || attachmentMap.get(basename) || null,
        });
      }
    }

    return NextResponse.json({
      submission_id: sub.id,
      kobo_id: sub.kobo_id,
      attachments_count: attachments.length,
      attachments_raw: attachments.map((a: any) => ({
        filename: a.filename,
        media_file_basename: a.media_file_basename,
        has_download_url: !!a.download_url,
        has_medium_url: !!a.download_medium_url,
        download_url_preview: (a.download_medium_url || a.download_url || "").substring(0, 100),
      })),
      attachment_map_keys: Array.from(attachmentMap.keys()),
      image_fields: imageFields,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
