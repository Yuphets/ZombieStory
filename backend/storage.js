const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let neonFactory = null;
try {
  ({ neon: neonFactory } = require("@neondatabase/serverless"));
} catch {
  neonFactory = null;
}

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL"
];

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

function createStorage() {
  const connection = resolveDatabaseConnection();
  if (connection.url && neonFactory) {
    return new NeonStorage(connection);
  }
  return new JsonStorage();
}

class JsonStorage {
  constructor() {
    this.ensureDb();
  }

  async login(username) {
    const db = this.readDb();
    let account = db.accounts.find((item) => item.username.toLowerCase() === username.toLowerCase());
    if (!account) {
      account = {
        id: crypto.randomUUID(),
        username,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.accounts.push(account);
      this.writeDb(db);
    }
    return { account, progress: db.progress[account.id] || null, avatars: db.avatars };
  }

  async listAvatars() {
    return this.readDb().avatars;
  }

  async upsertAvatar(avatar) {
    const db = this.readDb();
    const index = db.avatars.findIndex((item) => item.id === avatar.id);
    const record = { ...avatar, updatedAt: new Date().toISOString() };
    if (index >= 0) {
      db.avatars[index] = record;
    } else {
      db.avatars.push(record);
    }
    this.writeDb(db);
    return record;
  }

  async getProgress(accountId) {
    return this.readDb().progress[accountId] || null;
  }

  async saveProgress(accountId, state) {
    const db = this.readDb();
    db.progress[accountId] = { accountId, state, savedAt: new Date().toISOString() };
    this.writeDb(db);
    return db.progress[accountId];
  }

  async deleteProgress(accountId) {
    const db = this.readDb();
    delete db.progress[accountId];
    this.writeDb(db);
    return { ok: true };
  }

  async getDatabaseStatus() {
    return {
      connected: false,
      provider: "local-json",
      mode: "fallback",
      envKey: null
    };
  }

  async getArtStatus() {
    const db = this.readDb();
    return this.makeArtStatus(db.settings?.openaiApiKey);
  }

  async getArtSettings() {
    const db = this.readDb();
    const value = String(db.settings?.openaiApiKey || process.env.OPENAI_API_KEY || "").trim();
    return {
      configured: Boolean(value),
      provider: value ? "openai" : "fallback",
      source: db.settings?.openaiApiKey ? "stored" : process.env.OPENAI_API_KEY ? "environment" : "fallback"
    };
  }

  async saveArtKey(apiKey) {
    const db = this.readDb();
    db.settings.openaiApiKey = apiKey;
    this.writeDb(db);
    return this.makeArtStatus(apiKey);
  }

  async clearArtKey() {
    const db = this.readDb();
    db.settings.openaiApiKey = "";
    this.writeDb(db);
    return this.makeArtStatus("");
  }

  async getArtKey() {
    return String(this.readDb().settings?.openaiApiKey || process.env.OPENAI_API_KEY || "").trim();
  }

  async getSceneArt(key) {
    return this.readDb().sceneArt[key] || null;
  }

  async saveSceneArt(key, imageBase64, prompt) {
    const db = this.readDb();
    db.sceneArt[key] = {
      key,
      imageBase64,
      prompt,
      createdAt: new Date().toISOString()
    };
    this.writeDb(db);
    return db.sceneArt[key];
  }

  makeArtStatus(apiKey) {
    const value = String(apiKey || process.env.OPENAI_API_KEY || "").trim();
    return {
      configured: Boolean(value),
      enabled: Boolean(value),
      provider: value ? "openai" : "fallback",
      source: apiKey ? "stored" : process.env.OPENAI_API_KEY ? "environment" : "fallback"
    };
  }

  ensureDb() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      this.writeDb({
        accounts: [],
        progress: {},
        avatars: seedAvatars,
        settings: { openaiApiKey: "" },
        sceneArt: {}
      });
      return;
    }

    const db = this.readDb();
    db.accounts ||= [];
    db.progress ||= {};
    db.avatars = db.avatars?.length ? db.avatars : seedAvatars;
    db.settings ||= { openaiApiKey: "" };
    db.sceneArt ||= {};
    this.writeDb(db);
  }

  readDb() {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  }

  writeDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
}

class NeonStorage {
  constructor(connection) {
    this.connection = connection;
    this.sql = neonFactory(connection.url);
    this.ready = false;
  }

  async ensureSchema() {
    if (this.ready) {
      return;
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS app_accounts (
        id uuid PRIMARY KEY,
        username text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS app_progress (
        account_id uuid PRIMARY KEY REFERENCES app_accounts(id) ON DELETE CASCADE,
        state jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS app_avatars (
        id text PRIMARY KEY,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS app_scene_art (
        key text PRIMARY KEY,
        image_base64 text NOT NULL,
        prompt text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `;

    for (const avatar of seedAvatars) {
      await this.sql`
        INSERT INTO app_avatars (id, payload)
        VALUES (${avatar.id}, ${JSON.stringify(avatar)}::jsonb)
        ON CONFLICT (id) DO NOTHING
      `;
    }

    this.ready = true;
  }

  async login(username) {
    await this.ensureSchema();
    const existing = await this.sql`SELECT id, username, created_at, updated_at FROM app_accounts WHERE lower(username) = lower(${username}) LIMIT 1`;
    let account = existing[0];
    if (!account) {
      const id = crypto.randomUUID();
      const created = await this.sql`
        INSERT INTO app_accounts (id, username)
        VALUES (${id}, ${username})
        RETURNING id, username, created_at, updated_at
      `;
      account = created[0];
    }

    const progressRows = await this.sql`SELECT account_id, state, saved_at FROM app_progress WHERE account_id = ${account.id} LIMIT 1`;
    const avatarRows = await this.sql`SELECT payload FROM app_avatars ORDER BY updated_at DESC`;
    return {
      account: mapAccount(account),
      progress: progressRows[0] ? mapProgress(progressRows[0]) : null,
      avatars: avatarRows.map((row) => row.payload)
    };
  }

  async listAvatars() {
    await this.ensureSchema();
    const rows = await this.sql`SELECT payload FROM app_avatars ORDER BY updated_at DESC`;
    return rows.map((row) => row.payload);
  }

  async upsertAvatar(avatar) {
    await this.ensureSchema();
    const record = { ...avatar, updatedAt: new Date().toISOString() };
    await this.sql`
      INSERT INTO app_avatars (id, payload, updated_at)
      VALUES (${record.id}, ${JSON.stringify(record)}::jsonb, now())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `;
    return record;
  }

  async getProgress(accountId) {
    await this.ensureSchema();
    const rows = await this.sql`SELECT account_id, state, saved_at FROM app_progress WHERE account_id = ${accountId} LIMIT 1`;
    return rows[0] ? mapProgress(rows[0]) : null;
  }

  async saveProgress(accountId, state) {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO app_progress (account_id, state, saved_at)
      VALUES (${accountId}, ${JSON.stringify(state)}::jsonb, now())
      ON CONFLICT (account_id)
      DO UPDATE SET state = EXCLUDED.state, saved_at = now()
    `;
    const rows = await this.sql`SELECT account_id, state, saved_at FROM app_progress WHERE account_id = ${accountId} LIMIT 1`;
    return mapProgress(rows[0]);
  }

  async deleteProgress(accountId) {
    await this.ensureSchema();
    await this.sql`DELETE FROM app_progress WHERE account_id = ${accountId}`;
    return { ok: true };
  }

  async getDatabaseStatus() {
    await this.ensureSchema();
    await this.sql`SELECT 1`;
    return {
      connected: true,
      provider: "neon",
      mode: "serverless-postgres",
      envKey: this.connection.envKey
    };
  }

  async getArtStatus() {
    await this.ensureSchema();
    const key = await this.getArtKey();
    const configuredRows = await this.sql`SELECT value FROM app_settings WHERE key = 'openai_api_key' LIMIT 1`;
    return {
      configured: Boolean(key),
      enabled: Boolean(key),
      provider: key ? "openai" : "fallback",
      source: configuredRows[0] ? "stored" : process.env.OPENAI_API_KEY ? "environment" : "fallback"
    };
  }

  async getArtSettings() {
    await this.ensureSchema();
    const configuredRows = await this.sql`SELECT value FROM app_settings WHERE key = 'openai_api_key' LIMIT 1`;
    const value = String(configuredRows[0]?.value?.apiKey || process.env.OPENAI_API_KEY || "").trim();
    return {
      configured: Boolean(value),
      provider: value ? "openai" : "fallback",
      source: configuredRows[0] ? "stored" : process.env.OPENAI_API_KEY ? "environment" : "fallback"
    };
  }

  async saveArtKey(apiKey) {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('openai_api_key', ${JSON.stringify({ apiKey })}::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
    return {
      configured: Boolean(apiKey || process.env.OPENAI_API_KEY),
      enabled: Boolean(apiKey || process.env.OPENAI_API_KEY),
      provider: apiKey || process.env.OPENAI_API_KEY ? "openai" : "fallback",
      source: apiKey ? "stored" : process.env.OPENAI_API_KEY ? "environment" : "fallback"
    };
  }

  async clearArtKey() {
    await this.ensureSchema();
    await this.sql`DELETE FROM app_settings WHERE key = 'openai_api_key'`;
    return {
      configured: Boolean(process.env.OPENAI_API_KEY),
      enabled: Boolean(process.env.OPENAI_API_KEY),
      provider: process.env.OPENAI_API_KEY ? "openai" : "fallback",
      source: process.env.OPENAI_API_KEY ? "environment" : "fallback"
    };
  }

  async getArtKey() {
    await this.ensureSchema();
    const rows = await this.sql`SELECT value FROM app_settings WHERE key = 'openai_api_key' LIMIT 1`;
    return String(rows[0]?.value?.apiKey || process.env.OPENAI_API_KEY || "").trim();
  }

  async getSceneArt(key) {
    await this.ensureSchema();
    const rows = await this.sql`SELECT key, image_base64, prompt, created_at FROM app_scene_art WHERE key = ${key} LIMIT 1`;
    if (!rows[0]) {
      return null;
    }
    return {
      key: rows[0].key,
      imageBase64: rows[0].image_base64,
      prompt: rows[0].prompt,
      createdAt: rows[0].created_at
    };
  }

  async saveSceneArt(key, imageBase64, prompt) {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO app_scene_art (key, image_base64, prompt, created_at)
      VALUES (${key}, ${imageBase64}, ${prompt}, now())
      ON CONFLICT (key)
      DO UPDATE SET image_base64 = EXCLUDED.image_base64, prompt = EXCLUDED.prompt, created_at = now()
    `;
    return { key, imageBase64, prompt, createdAt: new Date().toISOString() };
  }
}

function mapAccount(row) {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProgress(row) {
  return {
    accountId: row.account_id,
    state: row.state,
    savedAt: row.saved_at
  };
}

function resolveDatabaseConnection() {
  for (const envKey of DATABASE_ENV_KEYS) {
    const value = String(process.env[envKey] || "").trim();
    if (value) {
      return { url: value, envKey };
    }
  }

  const host = String(process.env.PGHOST || "").trim();
  const database = String(process.env.PGDATABASE || "").trim();
  const user = String(process.env.PGUSER || "").trim();
  const password = String(process.env.PGPASSWORD || "").trim();
  const port = String(process.env.PGPORT || "5432").trim();
  const sslmode = String(process.env.PGSSLMODE || "require").trim();

  if (host && database && user) {
    const auth = password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
      : encodeURIComponent(user);
    const url = `postgresql://${auth}@${host}:${port}/${database}?sslmode=${encodeURIComponent(sslmode)}`;
    return { url, envKey: "PGHOST/PGDATABASE/PGUSER" };
  }

  return { url: "", envKey: null };
}

module.exports = {
  createStorage
};
