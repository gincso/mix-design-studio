import http from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = resolve(".");
const DATA_DIR = join(ROOT, "data");
const DB_FILE = join(DATA_DIR, "cases.json");
const PORT = process.env.PORT || 3000;

ensureStorage();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname === "/api/cases" && req.method === "GET") {
      const userId = (url.searchParams.get("userId") || "").trim();
      const cases = readCases().filter((item) => !userId || item.userId === userId);
      return sendJson(res, 200, { cases });
    }

    if (url.pathname === "/api/cases" && req.method === "POST") {
      const body = await readBody(req);
      const payload = typeof body === "string" ? JSON.parse(body) : body;
      const cases = readCases();
      const now = new Date().toISOString();
      const record = {
        id: payload.id || randomUUID(),
        userId: String(payload.userId || "default"),
        name: String(payload.name || "Untitled case"),
        snapshot: payload.snapshot || {},
        createdAt: payload.createdAt || now,
        updatedAt: now,
      };

      const index = cases.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        cases[index] = { ...cases[index], ...record, createdAt: cases[index].createdAt };
      } else {
        cases.unshift(record);
      }
      writeCases(cases);
      return sendJson(res, 200, { case: record });
    }

    if (url.pathname.startsWith("/api/cases/") && req.method === "DELETE") {
      const id = url.pathname.split("/").pop();
      const cases = readCases().filter((item) => item.id !== id);
      writeCases(cases);
      return sendJson(res, 200, { ok: true });
    }

    if (url.pathname.startsWith("/api/cases/") && req.method === "GET") {
      const id = url.pathname.split("/").pop();
      const record = readCases().find((item) => item.id === id);
      if (!record) {
        return sendJson(res, 404, { error: "Case not found" });
      }
      return sendJson(res, 200, { case: record });
    }

    return serveStatic(req, res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Mix Design Studio running at http://localhost:${PORT}`);
});

function ensureStorage() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DB_FILE)) {
    writeFileSync(DB_FILE, JSON.stringify({ cases: [] }, null, 2));
  }
}

function readCases() {
  const raw = readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.cases) ? parsed.cases : [];
}

function writeCases(cases) {
  writeFileSync(DB_FILE, JSON.stringify({ cases }, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res, pathname) {
  const filePath = resolve(ROOT, pathname === "/" ? "index.html" : `.${pathname}`);
  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    return sendJson(res, 404, { error: "Not found" });
  }

  const ext = extname(filePath);
  const type =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : "application/octet-stream";

  res.writeHead(200, { "Content-Type": type });
  res.end(readFileSync(filePath));
}
