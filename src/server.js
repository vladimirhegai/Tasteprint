import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { detectModels } from "./modelAdapters.js";
import { getReferenceCatalog } from "./referenceLibrary.js";
import {
  getAntiVibeOptions,
  getDirections,
  getFinalFiles,
  getIntakeQuestions,
  getOptionalAdditions,
  getPersonalityOptions,
  getPlan,
  getReferenceLikeOptions
} from "./orchestrator.js";
import { writeGeneratedFiles } from "./generator.js";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

export async function startServer(options) {
  const packageRootUrl = options.packageRootUrl || new URL("../", import.meta.url);
  const packageRoot = fileURLToPath(packageRootUrl);
  const publicDir = join(packageRoot, "public");
  const projectDir = options.projectDir || process.cwd();
  const host = options.host || "127.0.0.1";
  const preferredPort = Number.isFinite(options.port) ? options.port : 4317;
  const localOnly = Boolean(options.localOnly);
  // CLI ids forced to report as not-installed, so the not-detected gate can be exercised
  // even in dev:local (e.g. `npm run dev:local -- --no-claude`).
  const unavailable = Array.isArray(options.unavailable) ? options.unavailable : [];

  const server = createServer(async (request, response) => {
    try {
      await handleRequest(request, response, {
        publicDir,
        projectDir,
        packageRootUrl,
        localOnly,
        unavailable
      });
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Unexpected server error"
      });
    }
  });

  const port = await listenWithFallback(server, host, preferredPort);
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const url = `http://${host}:${actualPort}`;

  console.log(`Tasteprint is running at ${url}`);
  console.log(`Files will be generated in ${projectDir}`);

  // openPath lets a caller deep-link the launch (e.g. the anatomy editor at /?anatomy)
  // without disturbing the default "/" entry point.
  const openPath = typeof options.openPath === "string" ? options.openPath : "";
  const openUrl = `${url}${openPath}`;
  if (openPath) {
    console.log(`Anatomy editor: ${openUrl}`);
  }

  if (options.open) {
    openBrowser(openUrl);
  }

  return {
    server,
    url,
    projectDir
  };
}

async function handleRequest(request, response, context) {
  const url = new URL(request.url, "http://tasteprint.local");

  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, {
      ok: true,
      projectDir: context.projectDir,
      localOnly: context.localOnly
    });
  }

  if (request.method === "GET" && url.pathname === "/api/models") {
    return sendJson(response, 200, {
      models: detectModels({ localOnly: context.localOnly, unavailable: context.unavailable })
    });
  }

  if (request.method === "GET" && url.pathname === "/api/references") {
    return sendJson(response, 200, {
      references: await getReferenceCatalog(context.packageRootUrl)
    });
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/onboarding/")) {
    const body = await readJsonBody(request);
    const state = body.state || {};
    const action = url.pathname.split("/").pop();
    const result = await handleOnboardingAction(action, state, context);
    return sendJson(response, 200, result);
  }

  if (request.method === "POST" && url.pathname === "/api/write-files") {
    const body = await readJsonBody(request);
    if (!body.designMd || !body.skillMd) {
      return sendJson(response, 400, {
        error: "Missing designMd or skillMd."
      });
    }

    const files = await writeGeneratedFiles(context.projectDir, {
      designMd: body.designMd,
      skillMd: body.skillMd
    });

    return sendJson(response, 200, {
      ok: true,
      files
    });
  }

  if (request.method === "GET") {
    return serveStatic(request, response, context.publicDir, url.pathname);
  }

  sendJson(response, 404, {
    error: "Not found"
  });
}

async function handleOnboardingAction(action, state, context) {
  switch (action) {
    case "intake":
      return getIntakeQuestions(state, context);
    case "personality":
      return getPersonalityOptions(state, context);
    case "anti-vibe":
      return getAntiVibeOptions(state, context);
    case "reference-likes":
      return getReferenceLikeOptions(state, context);
    case "directions":
      return getDirections(state, context);
    case "optional-additions":
      return getOptionalAdditions(state, context);
    case "plan":
      return getPlan(state, context);
    case "final":
      return getFinalFiles(state, context);
    default:
      return {
        error: `Unknown onboarding action: ${action}`
      };
  }
}

async function serveStatic(request, response, publicDir, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    return sendText(response, 403, "Forbidden");
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(content);
  } catch {
    sendText(response, 404, "Not found");
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 4_000_000) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}

function listenWithFallback(server, host, preferredPort) {
  const tryPort = (port, attemptsLeft) => new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      if (error.code === "EADDRINUSE" && attemptsLeft > 0 && preferredPort !== 0) {
        resolve(tryPort(port + 1, attemptsLeft - 1));
      } else {
        reject(error);
      }
    };

    const onListening = () => {
      server.off("error", onError);
      resolve(port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  return tryPort(preferredPort, 20);
}

function openBrowser(url) {
  const command = process.platform === "win32"
    ? "cmd"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32"
    ? ["/c", "start", "", url]
    : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
}
