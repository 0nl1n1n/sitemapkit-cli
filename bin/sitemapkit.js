#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const COMMANDS = new Set(["discover", "extract", "full"]);
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

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

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : undefined;
}

function blocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"))]
    .map((match) => match[1]);
}

async function fetchSitemapXml(url) {
  const response = await fetch(url, { headers: { accept: "application/xml,text/xml,*/*" } });
  if (!response.ok) {
    throw new Error(`Sitemap returned ${response.status}: ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SITEMAP_BYTES) {
    throw new Error(`Sitemap exceeds the 50 MB limit: ${url}`);
  }
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const xml = isGzip ? gunzipSync(bytes, { maxOutputLength: MAX_SITEMAP_BYTES }) : bytes;
  return xml.toString("utf8");
}

export async function extractSitemapLocally(url, maxUrls = 50_000) {
  const seenSitemaps = new Set();
  const seenUrls = new Set();
  const urls = [];
  let truncated = false;

  async function visit(sitemapUrl, depth) {
    if (seenSitemaps.has(sitemapUrl) || truncated) return;
    if (depth > 5) throw new Error("Sitemap index nesting exceeds 5 levels");
    seenSitemaps.add(sitemapUrl);
    const xml = await fetchSitemapXml(sitemapUrl);

    if (/<sitemapindex(?:\s|>)/i.test(xml)) {
      for (const block of blocks(xml, "sitemap")) {
        const childUrl = tagValue(block, "loc");
        if (childUrl) await visit(new URL(childUrl, sitemapUrl).href, depth + 1);
        if (truncated) break;
      }
      return;
    }
    if (!/<urlset(?:\s|>)/i.test(xml)) {
      throw new Error(`Response is not an XML sitemap: ${sitemapUrl}`);
    }

    for (const block of blocks(xml, "url")) {
      const loc = tagValue(block, "loc");
      if (!loc || seenUrls.has(loc)) continue;
      if (urls.length >= maxUrls) {
        truncated = true;
        break;
      }
      seenUrls.add(loc);
      const entry = { loc };
      for (const tag of ["lastmod", "changefreq", "priority"]) {
        const value = tagValue(block, tag);
        if (value) entry[tag] = value;
      }
      urls.push(entry);
    }
  }

  await visit(url, 0);
  return {
    success: true,
    data: {
      sitemapUrl: url,
      sitemapsProcessed: seenSitemaps.size,
      totalUrls: urls.length,
      truncated,
      urls,
    },
  };
}

export async function runSitemapCommand(input, env = process.env) {
  if (input.command === "extract" && !env.SITEMAPKIT_API_KEY) {
    return extractSitemapLocally(input.url, input.maxUrls);
  }
  return requestSitemapKit(input, env);
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  const result = await runSitemapCommand(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isEntrypoint) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
