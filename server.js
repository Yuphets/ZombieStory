const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const seedAvatars = [
  {
    id: "seed-mara",
    name: "Mara Voss",
    gender: "Female",
    genderId: "female",
    ageBand: "Adult 26-45",
    ageBandId: "adult",
    profession: "Mechanic",
    professionId: "mechanic",
    reputation: 68,
    location: "tow yard",
    status: "alive"
  },
  {
    id: "seed-len",
    name: "Len Park",
    gender: "Non-binary",
    genderId: "non-binary",
    ageBand: "Teen 13-17",
    ageBandId: "teen",
    profession: "High School Student",
    professionId: "high-school-student",
    reputation: 42,
    location: "school roof",
    status: "alive"
  },
  {
    id: "seed-owen",
    name: "Owen Rusk",
    gender: "Male",
    genderId: "male",
    ageBand: "Older Adult 46+",
    ageBandId: "older-adult",
    profession: "Teacher",
    professionId: "teacher",
    reputation: 81,
    location: "old mill",
    status: "alive"
  }
];

ensureDb();

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Scratch Marks running at http://127.0.0.1:${PORT}/`);
});

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

  if (req.method === "POST" && url.pathname === "/api/accounts") {
    const body = await readBody(req);
    const username = cleanUsername(body.username);
    if (!username) {
      sendJson(res, 400, { error: "Username is required." });
      return;
    }

    let account = db.accounts.find((item) => item.username.toLowerCase() === username.toLowerCase());
    if (!account) {
      account = {
        id: crypto.randomUUID(),
        username,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.accounts.push(account);
      writeDb(db);
    }

    sendJson(res, 200, {
      account,
      progress: db.progress[account.id] || null,
      avatars: db.avatars
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/avatars") {
    sendJson(res, 200, { avatars: db.avatars });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/avatars") {
    const avatar = await readBody(req);
    if (!avatar.id) {
      sendJson(res, 400, { error: "Avatar id is required." });
      return;
    }

    const record = { ...avatar, updatedAt: new Date().toISOString() };
    const index = db.avatars.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      db.avatars[index] = record;
    } else {
      db.avatars.push(record);
    }
    writeDb(db);
    sendJson(res, 200, { avatar: record });
    return;
  }

  const progressMatch = url.pathname.match(/^\/api\/progress\/([^/]+)$/);
  if (progressMatch && req.method === "GET") {
    const accountId = decodeURIComponent(progressMatch[1]);
    sendJson(res, 200, { progress: db.progress[accountId] || null });
    return;
  }

  if (progressMatch && req.method === "PUT") {
    const accountId = decodeURIComponent(progressMatch[1]);
    const body = await readBody(req);
    db.progress[accountId] = {
      accountId,
      state: body.state,
      savedAt: new Date().toISOString()
    };
    const account = db.accounts.find((item) => item.id === accountId);
    if (account) {
      account.updatedAt = new Date().toISOString();
    }
    writeDb(db);
    sendJson(res, 200, { progress: db.progress[accountId] });
    return;
  }

  if (progressMatch && req.method === "DELETE") {
    const accountId = decodeURIComponent(progressMatch[1]);
    delete db.progress[accountId];
    writeDb(db);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Endpoint not found." });
}

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

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    writeDb({ accounts: [], progress: {}, avatars: seedAvatars });
    return;
  }

  const db = readDb();
  db.accounts ||= [];
  db.progress ||= {};
  db.avatars = db.avatars?.length ? db.avatars : seedAvatars;
  writeDb(db);
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function cleanUsername(username) {
  return String(username || "").trim().replace(/\s+/g, " ").slice(0, 32);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  return types[ext] || "application/octet-stream";
}
