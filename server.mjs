import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { handleApi } from "./server/api.mjs";

const dist = join(process.cwd(), "dist");
const port = Number(process.env.PORT) || 5173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const handled = await handleApi(req, res);
  if (handled) return;
  const url = new URL(req.url, "http://localhost");
  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.(\/|\\|$))+/, "");
  const relative = requested === sep || requested === "/" ? "index.html" : requested.replace(/^[/\\]+/, "");
  let file = join(dist, relative);
  const root = dist.endsWith(sep) ? dist : dist + sep;
  if (file !== dist && !file.startsWith(root)) {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) file = join(dist, "index.html");
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0");
