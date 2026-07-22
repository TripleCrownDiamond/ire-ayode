const BASE_URL = (process.env.KOBO_API_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "");
const TOKEN = process.env.KOBO_API_TOKEN || "";

const headers = { Authorization: `Token ${TOKEN}` };

export class KoboClient {
  async getForms() {
    const resp = await fetch(`${BASE_URL}/api/v2/assets.json`, { headers });
    if (!resp.ok) throw new Error(`Kobo API error: ${resp.status}`);
    return resp.json();
  }

  async getFormDetail(uid) {
    const resp = await fetch(`${BASE_URL}/api/v2/assets/${uid}.json`, { headers });
    if (!resp.ok) throw new Error(`Kobo API error: ${resp.status}`);
    return resp.json();
  }

  async getSubmissions(uid, limit = 1000) {
    const resp = await fetch(`${BASE_URL}/api/v2/assets/${uid}/data.json?limit=${limit}`, { headers });
    if (!resp.ok) throw new Error(`Kobo API error: ${resp.status}`);
    return resp.json();
  }

  async getMedia(uid, filename) {
    const resp = await fetch(`${BASE_URL}/api/v2/assets/${uid}/media/${filename}`, { headers });
    if (!resp.ok) throw new Error(`Kobo API error: ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    return { buffer, contentType: resp.headers.get("content-type") || "application/octet-stream" };
  }
}
