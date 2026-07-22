import { parseFields } from "./field-map";

function downloadFile(content: string | Blob, filename: string, mimeType?: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(data: Record<string, any>, filename: string) {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith("_") && !k.startsWith("formhub/") && !k.startsWith("meta/")) {
      clean[k] = v;
    }
  }
  downloadFile(JSON.stringify(clean, null, 2), `${filename}.json`, "application/json");
}

export function exportToCSV(data: Record<string, any>, filename: string) {
  const fields = parseFields(data);
  const rows = fields
    .filter((f) => !f.isImage && !Array.isArray(f.value))
    .map((f) => `"${f.label.replace(/"/g, '""')}","${String(f.value).replace(/"/g, '""')}"`)
    .join("\n");

  const header = '"Champ","Valeur"\n';
  downloadFile(header + rows, `${filename}.csv`, "text/csv;charset=utf-8");
}

export function exportAllSubmissions(
  submissions: any[],
  formName: string
) {
  const rows = submissions.map((sub) => {
    const data = sub.data || {};
    const clean: Record<string, any> = { kobo_id: sub.kobo_id, submitted_at: sub.submitted_at };
    for (const [k, v] of Object.entries(data)) {
      if (
        !k.startsWith("_") &&
        !k.startsWith("formhub/") &&
        !k.startsWith("meta/") &&
        !k.startsWith("__version__") &&
        typeof v !== "object"
      ) {
        clean[k] = v;
      }
    }
    return clean;
  });

  if (rows.length === 0) return;

  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const header = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",");
  const body = rows
    .map((r) =>
      keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  downloadFile(
    header + "\n" + body,
    `${formName.replace(/[^a-zA-Z0-9]/g, "_")}_export.csv`,
    "text/csv;charset=utf-8"
  );
}

// === EXPORT GÉOJSON (pour QGIS / Google Earth) ===

export function exportToGeoJSON(submissions: any[], formName: string) {
  const features: any[] = [];

  for (const sub of submissions) {
    const data = sub.data || {};
    const geo = data._geolocation;
    if (!geo || !Array.isArray(geo) || geo.length < 2) continue;

    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (
        !k.startsWith("_") &&
        !k.startsWith("formhub/") &&
        !k.startsWith("meta/") &&
        !k.startsWith("__version__") &&
        typeof v !== "object"
      ) {
        clean[k] = v;
      }
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [geo[1], geo[0]], // [lng, lat]
      },
      properties: {
        ...clean,
        submission_id: sub.kobo_id,
        submitted_at: sub.submitted_at,
      },
    });
  }

  const collection = {
    type: "FeatureCollection",
    features,
  };

  downloadFile(
    JSON.stringify(collection, null, 2),
    `${formName.replace(/[^a-zA-Z0-9]/g, "_")}_geojson.json`,
    "application/geo+json"
  );

  return features.length;
}

// === EXPORT HTML (rapport imprimable) ===

export function exportToHTML(submissions: any[], formName: string) {
  const rows = submissions.map((sub) => {
    const data = sub.data || {};
    const fields = Object.entries(data)
      .filter(([k]) => !k.startsWith("_") && !k.startsWith("formhub/") && !k.startsWith("meta/") && !k.startsWith("__version__"))
      .map(([k, v]) => ({ key: k, value: typeof v === "object" ? JSON.stringify(v) : String(v) }));

    return `<tr>
      <td style="padding:8px;border:1px solid #ddd;font-weight:bold">#${sub.kobo_id}</td>
      ${fields.map((f) => `<td style="padding:8px;border:1px solid #ddd">${f.value}</td>`).join("")}
    </tr>`;
  }).join("\n");

  // Collect all keys
  const allKeys = [...new Set(
    submissions.flatMap((sub) =>
      Object.keys(sub.data || {}).filter(
        (k) => !k.startsWith("_") && !k.startsWith("formhub/") && !k.startsWith("meta/") && !k.startsWith("__version__")
      )
    )
  )];

  const headers = allKeys.map((k) => `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${k}</th>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport - ${formName}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:nth-child(even) { background: #f8f9fa; }
    .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${formName}</h1>
  <div class="meta">
    <p>Date d'export : ${new Date().toLocaleString("fr-FR")}</p>
    <p>Nombre de soumissions : ${submissions.length}</p>
  </div>
  <table>
    <thead><tr><th style="padding:8px;border:1px solid #ddd;background:#f5f5f5">ID</th>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:20px;color:#999;font-size:11px;text-align:center">Généré par Ire Ayode</p>
</body>
</html>`;

  downloadFile(html, `${formName.replace(/[^a-zA-Z0-9]/g, "_")}_rapport.html`, "text/html;charset=utf-8");
}
