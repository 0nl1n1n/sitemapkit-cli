#!/usr/bin/env node

const COMMANDS = new Set(["discover", "extract", "full"]);

export function parseArguments(argv) {
  const [command, url, ...options] = argv;

  if (!COMMANDS.has(command) || !url) {
    throw new Error(
      "Usage: sitemapkit <discover|extract|full> <url> [--max-urls <1-50000>]",
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  let maxUrls;
  if (options.length > 0) {
    if (options.length !== 2 || options[0] !== "--max-urls" || command === "discover") {
      throw new Error("Only extract and full accept --max-urls <1-50000>");
    }
    maxUrls = Number(options[1]);
    if (!Number.isInteger(maxUrls) || maxUrls < 1 || maxUrls > 50_000) {
      throw new Error("--max-urls must be an integer between 1 and 50000");
    }
  }

  return { command, url, maxUrls };
}

export async function requestSitemapKit({ command, url, maxUrls }, env = process.env) {
  const apiKey = env.SITEMAPKIT_API_KEY;
  if (!apiKey) {
    throw new Error("Set SITEMAPKIT_API_KEY before running the command");
  }

  const baseUrl = (env.SITEMAPKIT_API_BASE_URL || "https://api.sitemapkit.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/v1/sitemap/${command}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ url, ...(maxUrls ? { maxUrls } : {}) }),
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const body = JSON.parse(text);
      message = body.error || body.message || text;
    } catch {
      // Keep the response text when the API does not return JSON.
    }
    throw new Error(`SitemapKit API returned ${response.status}: ${message || response.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("SitemapKit API returned an invalid JSON response");
  }
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const result = await requestSitemapKit(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntrypoint) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
