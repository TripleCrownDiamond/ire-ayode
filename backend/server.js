import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import { KoboClient } from "./kobo.js";

const app = express();
app.use(cors());
app.use(express.json());

// === Simple JSON store ===
const DB_FILE = "db.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { forms: {}, submissions: {}, logs: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const kobo = new KoboClient();

// === FORMS ===

app.get("/api/forms", async (req, res) => {
  try {
    const db = loadDB();
    const forms = Object.values(db.forms).sort((a, b) => (b.date_created || "").localeCompare(a.date_created || ""));
    res.json({ count: forms.length, results: forms });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/forms/:uid", async (req, res) => {
  try {
    const db = loadDB();
    const form = db.forms[req.params.uid];
    if (!form) return res.status(404).json({ error: "Form not found" });
    res.json(form);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === SUBMISSIONS ===

app.get("/api/forms/:uid/submissions", async (req, res) => {
  try {
    const db = loadDB();
    const allSubs = db.submissions[req.params.uid] || [];
    const { skip = 0, limit = 100 } = req.query;
    const paged = allSubs.slice(Number(skip), Number(skip) + Number(limit));
    res.json({ count: allSubs.length, results: paged });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/submissions/:id", async (req, res) => {
  try {
    const db = loadDB();
    for (const subs of Object.values(db.submissions)) {
      const found = subs.find((s) => String(s.id) === String(req.params.id));
      if (found) return res.json(found);
    }
    res.status(404).json({ error: "Submission not found" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === MEDIA (proxy) ===

app.get("/api/media/:uid/:filename(*)", async (req, res) => {
  try {
    const { uid, filename } = req.params;
    const { buffer, contentType } = await kobo.getMedia(uid, filename);
    res.setHeader("Content-Type", contentType);
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(404).json({ error: "Media not found" });
  }
});

// === SYNC ===

app.post("/api/sync", async (req, res) => {
  try {
    const result = await syncAll();
    res.json({ status: "success", result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/sync/:uid", async (req, res) => {
  try {
    const result = await syncFormSubmissions(req.params.uid);
    res.json({ status: "success", result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sync/status", (req, res) => {
  const db = loadDB();
  res.json({ logs: (db.logs || []).slice(-20).reverse() });
});

// === SYNC LOGIC ===

async function syncAll() {
  const data = await kobo.getForms();
  const forms = data.results || [];
  const db = loadDB();
  let synced = 0;

  for (const f of forms) {
    if (!db.forms[f.uid]) synced++;
    db.forms[f.uid] = {
      uid: f.uid,
      name: f.name || "",
      owner: f.owner__username || "",
      has_deployment: !!f.has_deployment,
      deployment_active: !!f.deployment__active,
      submission_count: f.deployment__submission_count || 0,
      last_submission_time: f.deployment__last_submission_time || null,
      date_created: f.date_created || null,
      date_modified: f.date_modified || null,
      status: f.status || "",
    };
  }

  // Sync submissions for forms that have them
  for (const form of Object.values(db.forms)) {
    if (form.submission_count > 0) {
      await syncFormSubmissions(form.uid);
    }
  }

  db.logs = db.logs || [];
  db.logs.push({ action: "sync_all", count: synced, time: new Date().toISOString() });
  saveDB(db);

  return { forms_synced: synced, total: forms.length };
}

async function syncFormSubmissions(formUid) {
  const data = await kobo.getSubmissions(formUid);
  const subs = data.results || [];
  const db = loadDB();

  if (!db.submissions[formUid]) db.submissions[formUid] = [];

  const existingIds = new Set(db.submissions[formUid].map((s) => s.kobo_id));
  let synced = 0;

  for (const s of subs) {
    const koboId = String(s._id || "");
    if (!existingIds.has(koboId)) {
      db.submissions[formUid].push({
        id: s._id,
        kobo_id: koboId,
        form_uid: formUid,
        submitted_by: s._submitted_by || "",
        submitted_at: s._submission_time || null,
        data: s,
      });
      synced++;
    }
  }

  db.logs = db.logs || [];
  db.logs.push({ form_uid: formUid, action: "sync_submissions", count: synced, time: new Date().toISOString() });
  saveDB(db);

  return { submissions_synced: synced, total: subs.length };
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
