import { NextResponse } from "next/server";
import { getSubmission } from "@/lib/data";
import { buildAttachmentIndex, resolveAttachment } from "@/lib/attachments";
import { parseFields } from "@/lib/field-map";

/**
 * Diagnostic de résolution des médias d'une soumission.
 * Utilise exactement la même logique que l'affichage — ce que montre cette
 * route est donc ce que l'interface tentera de charger.
 */
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
    const index = buildAttachmentIndex(data._attachments);

    const mediaFields = parseFields(data)
      .filter((f) => f.isImage || f.isFile)
      .map((f) => {
        const urls = resolveAttachment(index, f.value, f.key);
        return {
          key: f.key,
          label: f.label,
          value: f.value,
          kind: f.isImage ? "image" : "file",
          resolved: !!urls,
          urls: urls?.map((u) => u.substring(0, 120)) ?? [],
        };
      });

    return NextResponse.json({
      submission_id: sub.id,
      kobo_id: sub.kobo_id,
      attachments_count: attachments.length,
      attachments_raw: attachments.map((a: any) => ({
        filename: a.filename,
        media_file_basename: a.media_file_basename,
        question_xpath: a.question_xpath,
        mimetype: a.mimetype,
        has_download_url: !!a.download_url,
        has_medium_url: !!a.download_medium_url,
        download_url_preview: (a.download_url || a.download_medium_url || "").substring(0, 120),
      })),
      index_keys: {
        by_xpath: Array.from(index.byXpath.keys()),
        by_name: Array.from(index.byName.keys()),
      },
      media_fields: mediaFields,
      unresolved: mediaFields.filter((f) => !f.resolved).map((f) => f.key),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
