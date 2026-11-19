import { EVENT_CATEGORIES, EVENT_SECTION_ID, SECTIONS, isRealDate, matchCategory, tidyCategory } from "./sections.js";

const HASH_KEY = "nigora-editor";
const SESSION_KEY = "nigora-editing";
const CONTENT_KEY = "nigora-sections";
const CATEGORIES_KEY = "nigora-categories";
const ITERATIONS = 100_000;
const SECTION_IDS = new Set(SECTIONS.map((section) => section.id));

export function browserCall(method, path, payload) {
  if (method === "GET" && path === "/api/session") return browserSession();
  if (method === "GET" && path === "/api/content") return saved();
  if (method === "POST" && path === "/api/setup") return setup(payload?.password);
  if (method === "POST" && path === "/api/login") return login(payload?.password);
  if (method === "POST" && path === "/api/logout") return logout();
  if (method === "POST" && path === "/api/categories") return addCategory(payload || {});
  if (method === "POST" && path === "/api/entries") return createEntry(payload || {});
  const entry = path.match(/^\/api\/entries\/([a-zA-Z0-9-]+)$/);
  if (entry && method === "PATCH") return updateEntry(entry[1], payload || {});
  if (entry && method === "DELETE") return removeEntry(entry[1]);
  const move = path.match(/^\/api\/entries\/([a-zA-Z0-9-]+)\/move$/);
  if (move && method === "POST") return moveEntry(move[1], payload || {});
  fail("That did not save.");
}

function browserSession() {
  const record = readRecord();
  return {
    editing: Boolean(record) && readFlag(SESSION_KEY),
    needsSetup: !record,
  };
}

async function setup(password) {
  if (readRecord()) fail("A password is already set.");
  const value = cleanPassword(password);
  const record = await hashPassword(value);
  writeJson(HASH_KEY, record);
  writeFlag(SESSION_KEY, true);
  return { editing: true, needsSetup: false };
}

async function login(password) {
  const record = readRecord();
  if (!record) fail("Choose a password first.");
  if (!(await verifyPassword(String(password || ""), record))) fail("That password does not match.");
  writeFlag(SESSION_KEY, true);
  return { editing: true, needsSetup: false };
}

function logout() {
  writeFlag(SESSION_KEY, false);
  return { editing: false };
}

function createEntry(body) {
  requireEditor();
  const input = readEntry(body);
  const sections = loadSections();
  sections[input.sectionId].push({
    id: randomId(),
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    imageId: input.image || null,
    eventDate: input.eventDate,
    category: input.category,
  });
  saveSections(sections);
  return saved();
}

function updateEntry(id, body) {
  requireEditor();
  const sections = loadSections();
  const found = findEntry(sections, id);
  if (!found) fail("That piece is gone.");
  const input = readEntry(body, {
    partial: true,
    hasImage: Boolean(found.entry.imageId),
    sectionId: sectionIdOf(sections, id),
  });
  let imageId = found.entry.imageId;
  if (input.image === null) imageId = null;
  if (input.image) imageId = input.image;
  found.list[found.index] = {
    id: found.entry.id,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
    imageId,
    eventDate: input.eventDate,
    category: input.category,
  };
  saveSections(sections);
  return saved();
}

function removeEntry(id) {
  requireEditor();
  const sections = loadSections();
  const found = findEntry(sections, id);
  if (!found) fail("That piece is gone.");
  found.list.splice(found.index, 1);
  saveSections(sections);
  return saved();
}

function moveEntry(id, body) {
  requireEditor();
  const sections = loadSections();
  const found = findEntry(sections, id);
  if (!found) fail("That piece is gone.");
  let target = null;
  if (body.direction === "up") target = found.index - 1;
  else if (body.direction === "down") target = found.index + 1;
  else if (Number.isInteger(body.to)) target = body.to;
  else fail("Choose a direction.");
  if (target !== found.index && target >= 0 && target < found.list.length) {
    const [moved] = found.list.splice(found.index, 1);
    found.list.splice(target, 0, moved);
    saveSections(sections);
  }
  return saved();
}

function addCategory(body) {
  requireEditor();
  const tidy = tidyCategory(body.name);
  if (!tidy) fail("Name that category.");
  const existing = matchCategory(tidy, loadCategories());
  if (!existing) {
    const next = [...loadCategories(), tidy];
    writeJson(CATEGORIES_KEY, next);
    return { categories: next, name: tidy };
  }
  return { categories: loadCategories(), name: existing };
}

function requireEditor() {
  if (!browserSession().editing) fail("Sign in to edit.");
}

function loadSections() {
  const stored = readJson(CONTENT_KEY);
  const sections = Object.fromEntries(SECTIONS.map((section) => [section.id, []]));
  if (!stored || typeof stored !== "object") return sections;
  for (const section of SECTIONS) {
    const rows = Array.isArray(stored[section.id]) ? stored[section.id] : [];
    sections[section.id] = rows.map(normalizeEntry).filter(Boolean);
  }
  return sections;
}

function normalizeEntry(row) {
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    title: String(row.title || ""),
    body: String(row.body || ""),
    linkUrl: String(row.linkUrl || ""),
    imageId: row.imageId ? String(row.imageId) : null,
    eventDate: String(row.eventDate || ""),
    category: String(row.category || ""),
  };
}

function sectionIdOf(sections, id) {
  const found = Object.entries(sections).find(([, list]) => list.some((entry) => entry.id === id));
  return found ? found[0] : "";
}

function saved() {
  return { sections: loadSections(), categories: loadCategories() };
}

function loadCategories() {
  const stored = readJson(CATEGORIES_KEY);
  if (!Array.isArray(stored)) return [];
  const builtin = new Set(EVENT_CATEGORIES.map((name) => name.toLowerCase()));
  const seen = new Set();
  const names = [];
  for (const item of stored) {
    const name = tidyCategory(item);
    const key = name.toLowerCase();
    if (!name || builtin.has(key) || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function findEntry(sections, id) {
  for (const list of Object.values(sections)) {
    const index = list.findIndex((entry) => entry.id === id);
    if (index !== -1) return { list, index, entry: list[index] };
  }
  return null;
}

function readEntry(body, { partial = false, hasImage = false, sectionId = "" } = {}) {
  const resolved = partial ? sectionId : String(body.sectionId || "");
  if (!partial && !SECTION_IDS.has(resolved)) fail("Choose a section.");
  const title = String(body.title || "").trim().slice(0, 200);
  const text = String(body.body || "").trim().slice(0, 20000);
  const linkUrl = cleanLink(body.linkUrl);
  let image;
  if (body.image === null) image = null;
  else if (body.image) image = parseImage(body.image);
  const keepsImage = image === undefined && hasImage;
  const event = resolved === EVENT_SECTION_ID;
  let eventDate = "";
  let category = "";
  if (event) {
    eventDate = String(body.eventDate || "").trim();
    if (!eventDate) fail("Add a date.");
    if (!isRealDate(eventDate)) fail("Use a real date.");
    category = matchCategory(body.category, loadCategories());
    if (!category) fail("Choose a category.");
  }
  if (!title && !text && !linkUrl && !image && !keepsImage && !event) fail("Add a note, a link, or a picture.");
  return { sectionId: resolved, title, body: text, linkUrl, image, eventDate, category };
}

function parseImage(value) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(String(value));
  if (!match) fail("Use a jpeg, png, webp, or gif.");
  const encoded = match[2].replace(/\s/g, "");
  const bytes = Math.floor((encoded.length * 3) / 4);
  if (!bytes || bytes > 2_500_000) fail("That picture is too large.");
  return `data:${match[1].toLowerCase()};base64,${encoded}`;
}

function cleanLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("That link needs http or https.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") fail("That link needs http or https.");
  return url.toString().slice(0, 2000);
}

function cleanPassword(password) {
  const value = String(password || "");
  if (value.length < 8 || value.length > 200) fail("Use at least 8 characters.");
  return value;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return { iterations: ITERATIONS, salt: bytesToBase64(salt), hash: bytesToBase64(hash) };
}

async function verifyPassword(password, record) {
  let salt;
  let expected;
  try {
    salt = base64ToBytes(record.salt);
    expected = base64ToBytes(record.hash);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, record.iterations);
  return safeEqual(actual, expected);
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function readRecord() {
  const record = readJson(HASH_KEY);
  if (!record || typeof record.salt !== "string" || typeof record.hash !== "string") return null;
  const iterations = Number(record.iterations);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 400_000) return null;
  return { salt: record.salt, hash: record.hash, iterations };
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    fail("This browser could not keep that.");
  }
}

function readFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key, on) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    fail("This browser could not keep that.");
  }
}

function saveSections(sections) {
  writeJson(CONTENT_KEY, sections);
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) diff |= actual[index] ^ expected[index];
  return diff === 0;
}

function fail(message) {
  throw new Error(message);
}
