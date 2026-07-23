/**
 * Confirme tous les comptes utilisateur non confirmés.
 *
 *   node scripts/confirm-all-users.js            affiche les comptes en attente
 *   node scripts/confirm-all-users.js --confirm   confirme tous les comptes en attente
 *
 * Utile quand :
 *   - Le rate limit Supabase empêche l'envoi d'e-mails de confirmation
 *   - Vous voulez activer tous les comptes existants d'un coup
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env", ".env.local", path.join("frontend", ".env.local")]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!env[key]) env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const doConfirm = args.includes("--confirm");

async function main() {
  const { createClient } = require(path.join(ROOT, "frontend", "node_modules", "@supabase/supabase-js"));
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Lister tous les utilisateurs
  let page = 1;
  let allUsers = [];
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      console.error("Erreur listUsers:", error.message);
      process.exit(1);
    }

    allUsers = allUsers.concat(data.users);
    hasMore = data.users.length === 1000;
    page++;
  }

  const unconfirmed = allUsers.filter((u) => !u.email_confirmed_at);
  const confirmed = allUsers.filter((u) => u.email_confirmed_at);

  console.log(`\n  ${allUsers.length} utilisateur(s) au total`);
  console.log(`  ${confirmed.length} confirmé(s)`);
  console.log(`  ${unconfirmed.length} en attente de confirmation\n`);

  if (unconfirmed.length === 0) {
    console.log("  Aucun compte à confirmer.\n");
    return;
  }

  if (!doConfirm) {
    console.log("  Comptes en attente :");
    for (const u of unconfirmed) {
      console.log(`    - ${u.email} (créé le ${new Date(u.created_at).toLocaleDateString("fr-FR")})`);
    }
    console.log("\n  Relancez avec --confirm pour les activer.\n");
    return;
  }

  console.log("  Confirmation en cours...\n");

  let success = 0;
  let failed = 0;

  for (const u of unconfirmed) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      email_confirm: true,
    });

    if (error) {
      console.error(`    ✗ ${u.email}: ${error.message}`);
      failed++;
    } else {
      console.log(`    ✓ ${u.email}`);
      success++;
    }
  }

  console.log(`\n  Terminé : ${success} confirmé(s), ${failed} échec(s)\n`);
}

main().catch((e) => {
  console.error(`\n${e.message}\n`);
  process.exit(1);
});
