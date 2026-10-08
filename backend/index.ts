import path from "path";
import fs from "fs";
import { ServerResponse } from "http";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, ".env") });

import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

import db from "./db/mysqlClient";
import { getConfiguredRegion, resolveRegion, runWithRegion } from "./db/regions";
import uploadPresignRouter from "./uploadPresign";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const dtrInternalUrl = process.env.DTR_INTERNAL_URL?.trim();
const dtrProxy = dtrInternalUrl
  ? createProxyMiddleware({
      target: dtrInternalUrl,
      changeOrigin: false,
      xfwd: true,
      on: {
        error: (error, _req, res) => {
          console.error("DTR proxy error:", error);
          if (res instanceof ServerResponse) {
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "DTR service unavailable" }));
            } else {
              res.end();
            }
          }
        },
      },
    })
  : undefined;

if (!dtrInternalUrl) {
  console.warn("DTR proxy is not configured; set DTR_INTERNAL_URL to the DTR service URL.");
}


// add global crash handlers for better logs in Railway
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

app.use((req, res, next) => {
  const hostname = req.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname !== "dtr.mietubl-ph.com") return next();

  if (!dtrProxy) {
    return res.status(503).json({ error: "DTR proxy is not configured" });
  }

  return dtrProxy(req, res, next);
});

// CORS and JSON
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const hostname = new URL(origin).hostname;
        callback(null, Boolean(resolveRegion(hostname) || hostname === "localhost" || hostname === "127.0.0.1"));
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((req, res, next) => {
  const region = resolveRegion(req.hostname);
  if (region) {
    return runWithRegion(region, next);
  }

  const hostname = req.hostname.toLowerCase();
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim().toLowerCase();
  const isRailwayGeneratedDomain =
    hostname.endsWith(".up.railway.app") || (railwayDomain && hostname === railwayDomain);
  const isLocalHost = req.hostname === "localhost" || req.hostname === "127.0.0.1";
  const fallbackRegion = (isRailwayGeneratedDomain || isLocalHost) ? getConfiguredRegion() : undefined;
  if (fallbackRegion) {
    return runWithRegion(fallbackRegion, next);
  }

  res.status(421).json({ error: "Unknown region host" });
});

// helper delay used by endpoints (keeps behavior same as before)
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Auto-register all endpoint modules in backend/endpoints
async function registerEndpoints() {
  const endpointsDir = path.resolve(__dirname, "endpoints");
  if (!fs.existsSync(endpointsDir)) return;
  const files = fs.readdirSync(endpointsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
  for (const f of files) {
    try {
      const modPath = path.join(endpointsDir, f);
      // dynamic import to support ts-node or compiled JS
      const mod = require(modPath);
      const register = mod && (mod.default ?? mod);
      if (typeof register === "function") {
        register(app, db, delay);
      }
    } catch (err) {
      console.error("Failed to register endpoint", f, err);
    }
  }
}

async function start() {
  // mount presign upload router
  app.use(uploadPresignRouter);

  await registerEndpoints();

  const frontendDist = [
    path.resolve(process.cwd(), "frontend/dist"),
    path.resolve(process.cwd(), "../frontend/dist"),
    path.resolve(__dirname, "../../frontend/dist"),
  ].find((candidate) => fs.existsSync(path.join(candidate, "index.html")));
  if (frontendDist) {
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(frontendDist, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }

  // centralized error handler to ensure errors are logged and return 500
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Express error handler:", err && err.stack ? err.stack : err);
    try {
      res.status(500).json({ status: "error", message: "Internal server error" });
    } catch (_) {}
  });

  // start listening immediately
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} pid=${process.pid}`);
  });
}

start().catch((e) => {
  console.error("Fatal startup error:", e);
  process.exit(1);
});