const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApiRequest } = require("./backend/api-handler");

loadLocalEnv();

const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApiRequest(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Scratch Marks running at http://127.0.0.1:${PORT}/`);
});

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(content);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png"
  };
  return types[ext] || "application/octet-stream";
}

function loadLocalEnv() {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  for (const file of [".env.local", ".env"]) {
    const target = path.join(__dirname, file);
    if (!fs.existsSync(target)) {
      continue;
    }
    try {
      process.loadEnvFile(target);
    } catch {
      // Ignore malformed local env files so the app can still boot with defaults.
    }
  }
}
