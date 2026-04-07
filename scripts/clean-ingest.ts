/**
 * Deletes all documents + chunks from Supabase and removes all storage objects.
 * Run before re-ingesting to start fresh.
 *
 * Usage: npx tsx scripts/clean-ingest.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

async function main() {
  loadEnv();
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1. List all storage objects
  const { data: files, error: listErr } = await supa.storage
    .from("documents")
    .list("", { limit: 1000 });
  if (listErr) throw new Error(`Storage list failed: ${listErr.message}`);

  if (files && files.length > 0) {
    const paths = files.map((f) => f.name);
    const { error: removeErr } = await supa.storage.from("documents").remove(paths);
    if (removeErr) throw new Error(`Storage remove failed: ${removeErr.message}`);
    console.log(`Deleted ${paths.length} files from storage`);
  } else {
    console.log("Storage already empty");
  }

  // 2. Delete all document rows (chunks cascade automatically)
  const { error: delErr, count } = await supa
    .from("documents")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000"); // match all rows
  if (delErr) throw new Error(`Delete documents failed: ${delErr.message}`);
  console.log(`Deleted ${count ?? "?"} documents (chunks cascade deleted)`);

  console.log("\nClean complete — safe to re-run npm run bulk-ingest");
}

main().catch((err) => { console.error(err); process.exit(1); });
