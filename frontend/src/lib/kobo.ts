// Client API KoboToolbox — migré depuis backend/kobo.js

const BASE_URL = (
  process.env.KOBO_API_URL || "https://kf.kobotoolbox.org"
).replace(/\/$/, "");

const TOKEN = process.env.KOBO_API_TOKEN || "";

const headers: Record<string, string> = {
  Authorization: `Token ${TOKEN}`,
};

export interface KoboForm {
  uid: string;
  name: string;
  owner__username: string;
  has_deployment: boolean;
  deployment__active: boolean;
  deployment__submission_count: number;
  deployment__last_submission_time: string | null;
  date_created: string | null;
  date_modified: string | null;
  status: string;
  [key: string]: unknown;
}

export interface KoboSubmission {
  _id: number;
  _submitted_by: string;
  _submission_time: string;
  _attachments: KoboAttachment[];
  _geolocation: [number, number];
  [key: string]: unknown;
}

export interface KoboAttachment {
  download_url: string;
  mimetype: string;
  filename: string;
  media_file_basename: string;
  uid: string;
  is_deleted: boolean;
  download_large_url: string;
  download_medium_url: string;
  download_small_url: string;
  question_xpath: string;
}

export class KoboClient {
  async getForms(): Promise<{ count: number; results: KoboForm[] }> {
    const resp = await fetch(`${BASE_URL}/api/v2/assets.json`, { headers });
    if (!resp.ok) {
      throw new Error(`Kobo API error: ${resp.status} — ${await resp.text().catch(() => "")}`);
    }
    return resp.json();
  }

  async getFormDetail(uid: string): Promise<KoboForm> {
    const resp = await fetch(`${BASE_URL}/api/v2/assets/${uid}.json`, { headers });
    if (!resp.ok) {
      throw new Error(`Kobo API error: ${resp.status}`);
    }
    return resp.json();
  }

  async getSubmissions(
    uid: string,
    limit = 1000
  ): Promise<{ count: number; results: KoboSubmission[] }> {
    const resp = await fetch(
      `${BASE_URL}/api/v2/assets/${uid}/data.json?limit=${limit}`,
      { headers }
    );
    if (!resp.ok) {
      throw new Error(`Kobo API error: ${resp.status}`);
    }
    return resp.json();
  }

  async getMedia(
    uid: string,
    filename: string
  ): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    const resp = await fetch(
      `${BASE_URL}/api/v2/assets/${uid}/media/${filename}`,
      { headers }
    );
    if (!resp.ok) {
      throw new Error(`Kobo API error: ${resp.status}`);
    }
    const buffer = await resp.arrayBuffer();
    return {
      buffer,
      contentType: resp.headers.get("content-type") || "application/octet-stream",
    };
  }
}
