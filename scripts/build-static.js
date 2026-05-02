const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const entries = [
  "index.html",
  "engine",
  "multiplayer",
  "story",
  "ui"
];

build();

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const entry of entries) {
    const from = path.join(ROOT, entry);
    const to = path.join(DIST, entry);
    fs.cpSync(from, to, { recursive: true });
  }

  console.log(`Static site copied to ${DIST}`);
}
