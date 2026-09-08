/* The static server the tests and local previews run against.
 *
 * It replaced `python3 -m http.server`, for two reasons. The command itself is
 * not portable: on Windows the executable is `python`, so `npm run serve` could
 * not start at all. And that server keeps a request queue of five, which the
 * suite overruns the moment Playwright runs its files in parallel: a page would
 * load, its stylesheet would arrive, and `main.js` would come back
 * ERR_CONNECTION_REFUSED. The page then had no JavaScript, nothing revealed,
 * and a test would fail for a reason that had nothing to do with the site.
 *
 * Node needs no dependency to do this properly, and it can also answer the way
 * GitHub Pages does, which is what the addresses tests are really about: an
 * unknown path is 404.html, served with a 404.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/** Resolve a request path to a file inside the repository, or null. */
async function resolve(pathname) {
  const decoded = decodeURIComponent(pathname);
  // normalize collapses any ".." before it can climb out of the repository
  const target = normalize(join(root, decoded));
  if (!target.startsWith(root.endsWith(sep) ? root : root + sep) && target !== root) return null;

  try {
    const found = await stat(target);
    if (found.isDirectory()) return resolve(pathname.replace(/\/?$/, "/") + "index.html");
    return target;
  } catch {
    return null;
  }
}

function send(response, status, file) {
  response.writeHead(status, {
    "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const file = await resolve(pathname);

  if (file) {
    send(response, 200, file);
    return;
  }

  const notFound = await resolve("/404.html");
  if (notFound) {
    send(response, 404, notFound);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Serving ${root} on http://127.0.0.1:${port}\n`);
});
