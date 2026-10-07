import dns from "dns/promises";
import net from "net";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER;
const pass = process.env.DB_PASS;
const db = process.env.DB_NAME;
const caPath = process.env.DB_CA_PATH ? path.resolve(process.env.DB_CA_PATH) : undefined;

async function tcpCheck(host: string, port: number, timeout = 5000) {
  return new Promise<void>((resolve, reject) => {
    const s = net.connect({ host, port }, () => {
      s.end();
      resolve();
    });
    s.setTimeout(timeout, () => {
      s.destroy();
      reject(new Error("TCP connect timeout"));
    });
    s.on("error", (err) => reject(err));
  });
}

(async () => {
  console.log("Diagnostic start", { host, port, user, db, caPath: !!caPath });
  try {
    console.log("1) DNS lookup...");
    const lookup = await dns.lookup(host || "");
    console.log(" DNS result:", lookup);

    console.log("2) TCP connect...");
    await tcpCheck(host || "", port);
    console.log(" TCP connect OK");

    console.log("3) attempt mysql connection (short timeout) ...");
    const ssl: any = caPath && fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : undefined;
    const conn = await mysql.createConnection({ host, port, user, password: pass, database: db, ssl, connectTimeout: 5000 });
    const [rows] = await conn.execute("SELECT 1 as ok");
    console.log(" MySQL ping OK:", rows);
    await conn.end();
    console.log("All checks OK");
  } catch (err: any) {
    const errMsg = err && (err as any) && (err as any).message ? (err as any).message : String(err);
    console.error("Diagnostic failed:", errMsg);
    console.error(err);
    process.exitCode = 2;
  }
})();