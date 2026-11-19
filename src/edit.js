async function remoteJson(path, { method = "GET", body, unavailable }) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(unavailable);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || unavailable);
  return data;
}

export function getSession() {
  return remoteJson("/api/session", { unavailable: "The editor is unavailable." });
}

export function getContent() {
  return remoteJson("/api/content", { unavailable: "The page could not load." });
}

export function postJson(path, payload) {
  return remoteJson(path, { method: "POST", body: payload, unavailable: "That did not save." });
}

export function patchJson(path, payload) {
  return remoteJson(path, { method: "PATCH", body: payload, unavailable: "That did not save." });
}

export function deleteEntry(id) {
  return remoteJson(`/api/entries/${id}`, { method: "DELETE", unavailable: "That did not save." });
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
