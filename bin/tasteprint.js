#!/usr/bin/env node

import { startServer } from "../src/server.js";

function printHelp() {
  console.log(`Tasteprint

Usage:
  npx tasteprint [options]

Options:
  --host <host>      Host to bind. Default: 127.0.0.1
  --port <port>      Port to try first. Default: 4317
  --no-open          Do not open the browser automatically
  --local-only       Run the onboarding with local fallback logic only
  --help             Show this help

Generated files are written to the directory where you run the command.
If DESIGN.md or SKILL.md already exists, Tasteprint writes DESIGN-copy.md
or SKILL-copy.md instead.`);
}

function parseArgs(argv) {
  const options = {
    host: "127.0.0.1",
    port: 4317,
    open: true,
    localOnly: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--no-open") {
      options.open = false;
    } else if (arg === "--local-only") {
      options.localOnly = true;
    } else if (arg === "--host") {
      options.host = argv[index + 1] || options.host;
      index += 1;
    } else if (arg === "--port") {
      const parsed = Number.parseInt(argv[index + 1], 10);
      if (Number.isFinite(parsed)) {
        options.port = parsed;
      }
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

startServer({
  ...options,
  projectDir: process.cwd(),
  packageRootUrl: new URL("../", import.meta.url)
}).catch((error) => {
  console.error("Tasteprint failed to start:");
  console.error(error?.stack || error);
  process.exit(1);
});
