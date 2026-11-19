import { browserCall } from "./browserEditor.js";

let remote;

function remoteAvailable() {
  remote ??= probeRemote();
  return remote;
}

async function probeRemote() {
  try {
    const response = await fetch("/api/session");
    const type = response.headers.get("content-type") || "";
    return response.ok && type.includes("json");
  } catch {
    return false;
  }
}

async function remoteJson(path, { method = "GET", body, unavailable }) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || unavailable);
  return data;
}

export async function getSession() {
  if (!(await remoteAvailable())) return browserCall("GET", "/api/session");
  return remoteJson("/api/session", { unavailable: "The editor is unavailable." });
}

export async function getContent() {
  if (!(await remoteAvailable())) return browserCall("GET", "/api/content");
  return remoteJson("/api/content", { unavailable: "The page could not load." });
}

export async function postJson(path, payload) {
  if (!(await remoteAvailable())) return browserCall("POST", path, payload);
  return remoteJson(path, { method: "POST", body: payload, unavailable: "That did not save." });
}

export async function patchJson(path, payload) {
  if (!(await remoteAvailable())) return browserCall("PATCH", path, payload);
  return remoteJson(path, { method: "PATCH", body: payload, unavailable: "That did not save." });
}

export async function deleteEntry(id) {
  const path = `/api/entries/${id}`;
  if (!(await remoteAvailable())) return browserCall("DELETE", path);
  return remoteJson(path, { method: "DELETE", unavailable: "That did not save." });
}

export function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That picture could not be read."));
    };
    image.src = url;
  });
}
