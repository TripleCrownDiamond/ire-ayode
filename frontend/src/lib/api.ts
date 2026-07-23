const API_BASE = "/api";

export async function fetchForms() {
  const res = await fetch(`${API_BASE}/forms`);
  if (!res.ok) throw new Error("Failed to fetch forms");
  return res.json();
}

export async function fetchForm(uid: string) {
  const res = await fetch(`${API_BASE}/forms/${uid}`);
  if (!res.ok) throw new Error("Failed to fetch form");
  return res.json();
}

export async function fetchSubmissions(formUid: string, skip = 0, limit = 100) {
  const res = await fetch(`${API_BASE}/forms/${formUid}/submissions?skip=${skip}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json();
}

export async function fetchSubmission(id: number) {
  const res = await fetch(`${API_BASE}/submissions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch submission");
  return res.json();
}

export async function updateSubmissionStatus(id: number, validated: string, notes?: string) {
  const res = await fetch(`${API_BASE}/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ validated, notes }),
  });
  if (!res.ok) throw new Error("Failed to update submission status");
  return res.json();
}

export async function triggerSync() {
  const res = await fetch(`${API_BASE}/sync`, { method: "POST" });
  if (!res.ok) throw new Error("Sync failed");
  return res.json();
}

export async function syncForm(uid: string) {
  const res = await fetch(`${API_BASE}/sync/${uid}`, { method: "POST" });
  if (!res.ok) throw new Error("Sync failed");
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function updateSubmissionData(id: number, data: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/submissions/${id}/data`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error("Failed to update submission data");
  return res.json();
}

/**
 * URL du proxy média.
 * `downloadUrls` : URL candidates issues des `_attachments` Kobo, dans l'ordre
 * de préférence. Le proxy les essaie l'une après l'autre — indispensable car
 * Kobo ne génère pas de miniature pour tous les formats (les PNG de signature
 * renvoient souvent 404 sur `download_medium_url` alors que l'original existe).
 */
export function getMediaUrl(
  uid: string,
  filename: string,
  downloadUrls?: string | string[],
  /** Id de la soumission — permet de retrouver directement la copie archivée */
  submissionId?: number
) {
  const urls = (Array.isArray(downloadUrls) ? downloadUrls : downloadUrls ? [downloadUrls] : [])
    .filter(Boolean)
    .slice(0, 4);
  const path = filename
    ? filename.split("/").map(encodeURIComponent).join("/")
    : "attachment";
  const params = urls.map((u) => `url=${encodeURIComponent(u)}`);
  if (submissionId) params.unshift(`sub=${submissionId}`);
  const query = params.join("&");
  return `${API_BASE}/media/${uid}/${path}${query ? `?${query}` : ""}`;
}

/** Supprime une soumission de la plateforme (suppression logique, réversible). */
export async function deleteSubmission(id: number, reason?: string) {
  const res = await fetch(`${API_BASE}/submissions/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Suppression impossible");
  }
  return res.json();
}

export async function restoreSubmission(id: number) {
  const res = await fetch(`${API_BASE}/submissions/${id}?action=restore`, { method: "POST" });
  if (!res.ok) throw new Error("Restauration impossible");
  return res.json();
}

/** Lance un lot d'archivage des médias dans le stockage local. */
export async function archiveMedia(limit = 25, formUid?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (formUid) params.set("form", formUid);
  const res = await fetch(`${API_BASE}/media/archive?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Archivage impossible");
  return res.json();
}

export async function fetchArchiveStatus() {
  const res = await fetch(`${API_BASE}/media/archive`);
  if (!res.ok) throw new Error("Statut d'archivage indisponible");
  return res.json();
}
