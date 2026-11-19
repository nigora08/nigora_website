import { mkdir, readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool;
let local;
let ready;

export function databaseReady() {
  ready ??= start().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function sql(text, params = []) {
  const query = await databaseReady();
  return query(text, params);
}

async function start() {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const query = async (text, params) => (await pool.query(text, params)).rows;
    await applyMigrations(query);
    return query;
  }

  local ??= openLocal().catch((error) => {
    local = undefined;
    throw error;
  });
  const db = await local;
  const query = async (text, params) => (await db.query(text, params)).rows;
  await applyMigrations(query, (script) => db.exec(script));
  return query;
}

async function openLocal() {
  await mkdir(".data", { recursive: true });
  return new PGlite(".data/pglite");
}

async function applyMigrations(query, exec) {
  await query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await query("select name from schema_migrations")).map((row) => row.name));
  const files = (await readdir("migrations").catch(() => []))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const script = await readFile(`migrations/${file}`, "utf8");
    if (exec) await exec(script);
    else await query(script);
    await query("insert into schema_migrations (name) values ($1)", [file]);
  }
}
