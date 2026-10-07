import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { getCurrentRegion, Region } from "./regions";

function resolveEnvPath() {
  // candidates in order of preference
  const candidates = [
    path.resolve(__dirname, "../.env"),          // relative to db (typical in source)
    path.resolve(__dirname, "../../.env"),       // if compiled into nested dist folders
    path.resolve(process.cwd(), "backend/.env"), // when cwd is repo root (deployment)
    path.resolve(process.cwd(), ".env"),         // when cwd is backend or repo root with .env
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return undefined;
}

const envPath = resolveEnvPath();
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  // fallback: let dotenv try default locations (process.cwd())
  dotenv.config();
}

const pools = new Map<Region, mysql.Pool>();
const poolInitializations = new Map<Region, Promise<mysql.Pool>>();

function caFilePath(): string | undefined {
  const configuredPath = process.env.DB_CA_PATH;
  if (!configuredPath) return undefined;
  if (path.isAbsolute(configuredPath)) return configuredPath;

  const candidates = [
    path.resolve(process.cwd(), configuredPath),
    path.resolve(process.cwd(), "..", configuredPath),
    path.resolve(process.cwd(), "backend", configuredPath),
    path.resolve(__dirname, "../..", configuredPath),
    path.resolve(__dirname, "..", configuredPath),
  ];
  const resolvedPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(`DB_CA_PATH does not exist: ${configuredPath}`);
  }
  return resolvedPath;
}

function createRegionPool(region: Region): mysql.Pool {
  const variable = `DB_URL_${region.toUpperCase()}`;
  const connectionUrl = process.env[variable];
  if (!connectionUrl) throw new Error(`${variable} is not set`);

  const url = new URL(connectionUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mysql2:") {
    throw new Error(`${variable} must use the mysql:// or mysql2:// protocol`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) throw new Error(`${variable} must include a database name`);

  const sslMode = (process.env.DB_SSLMODE || "").toUpperCase();
  const caPath = caFilePath();
  const allowInsecure = (process.env.DB_ALLOW_INSECURE_SSL || "false").toLowerCase() === "true";
  let ssl: mysql.ConnectionOptions["ssl"];
  if (sslMode === "REQUIRED" || caPath) {
    if (caPath) {
      ssl = { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
    } else {
      ssl = { rejectUnauthorized: !allowInsecure };
    }
  }

  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    waitForConnections: true,
    connectionLimit: 5,
    ssl,
  });
}

export async function initPool(region: Region = getCurrentRegion()): Promise<mysql.Pool> {
  const existing = pools.get(region);
  if (existing) return existing;

  const initializing = poolInitializations.get(region);
  if (initializing) return initializing;

  const initialization = initializeRegionPool(region);
  poolInitializations.set(region, initialization);
  try {
    return await initialization;
  } finally {
    poolInitializations.delete(region);
  }
}

async function initializeRegionPool(region: Region): Promise<mysql.Pool> {
  const retries = Math.max(1, Number(process.env.DB_INIT_RETRIES || 5));
  let delayMs = Math.max(100, Number(process.env.DB_INIT_RETRY_DELAY_MS || 1000));
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const pool = createRegionPool(region);
    try {
      const conn = await pool.getConnection();
      try {
        await conn.ping();
      } finally {
        conn.release();
      }
      pools.set(region, pool);
      if (attempt > 1) {
        console.info(`Database for ${region} connected on attempt ${attempt}`);
      }
      return pool;
    } catch (err) {
      lastError = err;
      await pool.end();
      const isLast = attempt === retries;
      console.warn(`Database connection for ${region} failed on attempt ${attempt}${isLast ? "" : `; retrying in ${delayMs}ms`}`, err);
      if (isLast) break;
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(30000, Math.floor(delayMs * 2));
    }
  }

  throw lastError || new Error(`Failed to initialize database pool for ${region}`);
}

export default {
  initPool,
  async get(sql: string, params: any[] = []) {
    const p = await initPool();
    const [rows]: any = await p.execute(sql, params);
    return (rows && rows.length) ? rows[0] : null;
  },

  async all(sql: string, params: any[] = []) {
    const p = await initPool();
    const [rows]: any = await p.execute(sql, params);
    return rows || [];
  },

  async run(sql: string, params: any[] = []) {
    const p = await initPool();
    const [res]: any = await p.execute(sql, params);
    return {
      lastID: res && (res.insertId ?? 0),
      changes: res && (res.affectedRows ?? 0),
      raw: res,
    };
  },

  async end() {
    await Promise.all([...pools.values()].map((pool) => pool.end()));
    pools.clear();
  },

  get pool() {
    return pools.get(getCurrentRegion()) ?? null;
  }
};