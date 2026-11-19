import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SECTIONS } from "../src/sections.js";
import { sql } from "./db.mjs";

const scryptAsync = promisify(scrypt);
const SECTION_IDS = new Set(SECTIONS.map((section) => section.id));
const COOKIE = "nigora_edit";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const fails = new Map();

export async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (req.method === "GET" && url.pathname === "/api/session") {
      return json(res, {
        editing: await isEditor(req),
        needsSetup: (await passwordMode()) === "none",
      });
    }
    if (req.method === "GET" && url.pathname === "/api/content") {
      return json(res, { sections: await loadSections() });
    }
    const media = url.pathname.match(/^\/api\/media\/([a-zA-Z0-9-]+)$/);
    if (req.method === "GET" && media) return sendMedia(res, media[1]);

    if (!sameOrigin(req)) return json(res, { error: "That request was refused." }, 403);

    if (req.method === "POST" && url.pathname === "/api/setup") return setup(req, res);
    if (req.method === "POST" && url.pathname === "/api/login") return login(req, res);
    if (req.method === "POST" && url.pathname === "/api/logout") return logout(req, res);

    if (!(await isEditor(req))) return json(res, { error: "Sign in to edit." }, 401);

    if (req.method === "POST" && url.pathname === "/api/entries") return createEntry(req, res);
    const entry = url.pathname.match(/^\/api\/entries\/([a-zA-Z0-9-]+)$/);
    if (entry && req.method === "PATCH") return updateEntry(req, res, entry[1]);
    if (entry && req.method === "DELETE") return deleteEntry(res, entry[1]);
    const move = url.pathname.match(/^\/api\/entries\/([a-zA-Z0-9-]+)\/move$/);
    if (move && req.method === "POST") return moveEntry(req, res, move[1]);

    return json(res, { error: "Not found." }, 404);
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error("api error");
    return json(res, { error: error.publicMessage || "Something went wrong." }, status);
  }
}

async function setup(req, res) {
  if ((await passwordMode()) !== "none") {
    return json(res, { error: "A password is already set." }, 409);
  }
  const body = await readJson(req);
  const password = cleanPassword(body.password);
  await sql("insert into editor (id, password_hash) values (1, $1)", [await hashPassword(password)]);
  await startSession(req, res);
  return json(res, { editing: true, needsSetup: false });
}

async function login(req, res) {
  const ip = clientIp(req);
  if (limited(ip)) return json(res, { error: "Too many tries. Wait a few minutes." }, 429);
  if ((await passwordMode()) === "none") {
    return json(res, { error: "Choose a password first." }, 409);
  }
  const body = await readJson(req);
  const password = String(body.password || "");
  if (!(await checkPassword(password))) {
    markFail(ip);
    return json(res, { error: "That password does not match." }, 401);
  }
  fails.delete(ip);
  await startSession(req, res);
  return json(res, { editing: true, needsSetup: false });
}

async function logout(req, res) {
  const token = cookies(req)[COOKIE];
  if (token) await sql("delete from sessions where token_hash = $1", [digest(token)]);
  res.setHeader("set-cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return json(res, { editing: false });
}

async function createEntry(req, res) {
  const input = await readEntry(await readJson(req));
  const positions = await sql(
    "select coalesce(max(position), 0) as max from entries where section_id = $1",
    [input.sectionId],
  );
  const id = randomBytes(12).toString("hex");
  let imageId = null;
  if (input.image) imageId = await storeImage(input.image);
  await sql(
    `insert into entries (id, section_id, title, body, link_url, image_id, position)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.sectionId, input.title, input.body, input.linkUrl, imageId, Number(positions[0].max) + 1],
  );
  return json(res, { sections: await loadSections() });
}

async function updateEntry(req, res, id) {
  const current = await sql("select image_id from entries where id = $1", [id]);
  if (!current[0]) return json(res, { error: "That piece is gone." }, 404);
  const input = await readEntry(await readJson(req), {
    partial: true,
    hasImage: Boolean(current[0].image_id),
  });
  let imageId = current[0].image_id;
  if (input.image === null) imageId = null;
  if (input.image) imageId = await storeImage(input.image);
  await sql(
    "update entries set title = $2, body = $3, link_url = $4, image_id = $5 where id = $1",
    [id, input.title, input.body, input.linkUrl, imageId],
  );
  if (current[0].image_id && current[0].image_id !== imageId) await deleteImageIfUnused(current[0].image_id);
  return json(res, { sections: await loadSections() });
}

async function deleteEntry(res, id) {
  const current = await sql("select image_id from entries where id = $1", [id]);
  if (!current[0]) return json(res, { error: "That piece is gone." }, 404);
  await sql("delete from entries where id = $1", [id]);
  if (current[0].image_id) await deleteImageIfUnused(current[0].image_id);
  return json(res, { sections: await loadSections() });
}

async function moveEntry(req, res, id) {
  const body = await readJson(req);
  const direction = body.direction === "up" ? -1 : body.direction === "down" ? 1 : 0;
  if (!direction) return json(res, { error: "Choose a direction." }, 400);
  const current = await sql("select section_id from entries where id = $1", [id]);
  if (!current[0]) return json(res, { error: "That piece is gone." }, 404);
  const rows = await sql(
    "select id from entries where section_id = $1 order by position asc, created_at asc",
    [current[0].section_id],
  );
  const index = rows.findIndex((row) => row.id === id);
  const swap = rows[index + direction];
  if (swap) {
    await sql("update entries set position = $2 where id = $1", [id, index + direction]);
    await sql("update entries set position = $2 where id = $1", [swap.id, index]);
  }
  return json(res, { sections: await loadSections() });
}

async function loadSections() {
  const rows = await sql(
    `select id, section_id, title, body, link_url, image_id, position
     from entries
     order by position asc, created_at asc`,
  );
  const sections = Object.fromEntries(SECTIONS.map((section) => [section.id, []]));
  for (const row of rows) {
    if (!sections[row.section_id]) continue;
    sections[row.section_id].push({
      id: row.id,
      title: row.title,
      body: row.body,
      linkUrl: row.link_url,
      imageId: row.image_id,
    });
  }
  return sections;
}

async function sendMedia(res, id) {
  const rows = await sql("select mime, data from images where id = $1", [id]);
  if (!rows[0]) return json(res, { error: "Not found." }, 404);
  const data = asBuffer(rows[0].data);
  res.writeHead(200, {
    "content-type": rows[0].mime,
    "cache-control": "public, max-age=86400",
    "content-length": data.length,
  });
  res.end(data);
  return true;
}

async function storeImage(image) {
  const id = randomBytes(12).toString("hex");
  await sql("insert into images (id, mime, data) values ($1, $2, $3)", [id, image.mime, image.data]);
  return id;
}

async function deleteImageIfUnused(id) {
  const used = await sql("select id from entries where image_id = $1", [id]);
  if (used.length === 0) await sql("delete from images where id = $1", [id]);
}

async function readEntry(body, { partial = false, hasImage = false } = {}) {
  const sectionId = String(body.sectionId || "");
  if (!partial && !SECTION_IDS.has(sectionId)) fail(400, "Choose a section.");
  const title = String(body.title || "").trim().slice(0, 200);
  const text = String(body.body || "").trim().slice(0, 20000);
  const linkUrl = cleanLink(body.linkUrl);
  let image;
  if (body.image === null) image = null;
  else if (body.image) image = parseImage(body.image);
  const keepsImage = image === undefined && hasImage;
  if (!title && !text && !linkUrl && !image && !keepsImage) {
    fail(400, "Add a note, a link, or a picture.");
  }
  return { sectionId, title, body: text, linkUrl, image };
}

function parseImage(value) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(String(value));
  if (!match) fail(400, "Use a jpeg, png, webp, or gif.");
  const data = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!data.length || data.length > 2_500_000) fail(413, "That picture is too large.");
  return { mime: match[1].toLowerCase(), data };
}

function cleanLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(400, "That link needs http or https.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") fail(400, "That link needs http or https.");
  return url.toString().slice(0, 2000);
}

async function passwordMode() {
  if (process.env.EDITOR_PASSWORD) return "env";
  const rows = await sql("select id from editor where id = 1");
  return rows[0] ? "db" : "none";
}

async function checkPassword(password) {
  const secret = process.env.EDITOR_PASSWORD;
  if (secret) return matchSecret(password, secret);
  const rows = await sql("select password_hash from editor where id = 1");
  if (!rows[0]) return false;
  return verifyPassword(password, rows[0].password_hash);
}

function cleanPassword(password) {
  const value = String(password || "");
  if (value.length < 8 || value.length > 200) fail(400, "Use at least 8 characters.");
  return value;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  const [kind, salt, hex] = String(stored).split(":");
  if (kind !== "scrypt" || !salt || !hex) return false;
  const actual = await scryptAsync(password, salt, 32);
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function matchSecret(password, secret) {
  const actual = createHash("sha256").update(password).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(actual, expected);
}

async function isEditor(req) {
  const token = cookies(req)[COOKIE];
  if (!token) return false;
  const tokenHash = digest(token);
  const rows = await sql("select expires_at from sessions where token_hash = $1", [tokenHash]);
  if (!rows[0]) return false;
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    await sql("delete from sessions where token_hash = $1", [tokenHash]);
    return false;
  }
  return true;
}

async function startSession(req, res) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MS);
  await sql("insert into sessions (token_hash, expires_at) values ($1, $2)", [digest(token), expires.toISOString()]);
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  res.setHeader(
    "set-cookie",
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`,
  );
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "local";
}

function limited(ip) {
  const now = Date.now();
  const row = fails.get(ip);
  if (!row || now - row.at > 10 * 60 * 1000) return false;
  return row.n >= 8;
}

function markFail(ip) {
  const now = Date.now();
  const row = fails.get(ip);
  if (!row || now - row.at > 10 * 60 * 1000) fails.set(ip, { n: 1, at: now });
  else row.n += 1;
}

function asBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === "string" && data.startsWith("\\x")) return Buffer.from(data.slice(2), "hex");
  return Buffer.from(data);
}

async function readJson(req) {
  const raw = await readBody(req, 4_000_000);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    fail(400, "That request was refused.");
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("too large"), { status: 413, publicMessage: "That picture is too large." }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, payload, status = 200) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
  return true;
}

function fail(status, publicMessage) {
  throw Object.assign(new Error(publicMessage), { status, publicMessage });
}
