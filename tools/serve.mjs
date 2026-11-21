// Tiny static server for dist/ (no dependencies). Binds 0.0.0.0 so the sandbox
// preview proxy can reach it; the service worker is served no-store so
// development reloads always pick up changes.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT || 8080);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".nes": "application/octet-stream",
  ".md": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error("forbidden");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": file.endsWith("sw.js") ? "no-store" : "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Gun Nac Offline Player -> http://0.0.0.0:${port}`);
});
