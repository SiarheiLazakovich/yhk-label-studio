// Minimal static server: Web Bluetooth only works over https:// or on localhost.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 5173);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const ALLOWED = ["/index.html", "/js/", "/css/", "/vendor/", "/icons/", "/manifest.webmanifest", "/sw.js", "/fonts/", "/ios/"];

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (path === "/") path = "/index.html";
  if (!ALLOWED.some((p) => path === p || path.startsWith(p))) { res.writeHead(404).end("Not found"); return; }
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-cache" }).end(body);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(PORT, "127.0.0.1", () => console.log(`YHK Label Studio → http://localhost:${PORT}`));
