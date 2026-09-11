import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { formatCommandResult, parseArguments, requestSitemapKit, runSitemapCommand } from "../bin/sitemapkit.js";
import { parseActionInputs, runAction } from "../bin/action.js";

const execFileAsync = promisify(execFile);

let server;
let baseUrl;
let request;

before(async () => {
  server = http.createServer((incoming, response) => {
    if (incoming.url === "/sitemap-index.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end(`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>${baseUrl}/pages.xml</loc></sitemap>
      </sitemapindex>`);
      return;
    }
    if (incoming.url === "/pages.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc><lastmod>2026-09-01</lastmod></url>
        <url><loc>https://example.com/search?a=1&amp;b=2</loc></url>
      </urlset>`);
      return;
    }
    if (incoming.url === "/pages.xml.gz") {
      response.writeHead(200, { "content-type": "application/gzip" });
      response.end(gzipSync(`<?xml version="1.0"?><urlset>
        <url><loc>https://example.com/compressed</loc></url>
      </urlset>`));
      return;
    }
    let body = "";
    incoming.setEncoding("utf8");
    incoming.on("data", (chunk) => {
      body += chunk;
    });
    incoming.on("end", () => {
      request = {
        method: incoming.method,
        url: incoming.url,
        apiKey: incoming.headers["x-api-key"],
        body: JSON.parse(body),
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ success: true, data: { totalUrls: 2 } }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("parses a full extraction command", () => {
  assert.deepEqual(parseArguments(["full", "https://example.com", "--max-urls", "200"]), {
    command: "full",
    url: "https://example.com",
    maxUrls: 200,
  });
});

test("prints extracted locations as a newline-delimited URL list", () => {
  const input = parseArguments([
    "extract",
    "https://example.com/sitemap.xml",
    "--format",
    "urls",
  ]);

  assert.equal(input.format, "urls");
  assert.equal(
    formatCommandResult(
      {
        success: true,
        data: {
          urls: [
            { loc: "https://example.com/" },
            { loc: "https://example.com/search?a=1&b=2" },
          ],
        },
      },
      input.format,
    ),
    "https://example.com/\nhttps://example.com/search?a=1&b=2\n",
  );
});

test("maps GitHub Action inputs to a CLI request", () => {
  assert.deepEqual(
    parseActionInputs({
      INPUT_COMMAND: "extract",
      INPUT_URL: "https://example.com/sitemap.xml",
      INPUT_MAX_URLS: "250",
    }),
    {
      command: "extract",
      url: "https://example.com/sitemap.xml",
      maxUrls: 250,
    },
  );
});

test("rejects invalid limits", () => {
  assert.throws(
    () => parseArguments(["extract", "https://example.com/sitemap.xml", "--max-urls", "50001"]),
    /between 1 and 50000/,
  );
});

test("calls the selected SitemapKit endpoint", async () => {
  const result = await requestSitemapKit(
    { command: "full", url: "https://example.com", maxUrls: 200 },
    { SITEMAPKIT_API_KEY: "sk_test", SITEMAPKIT_API_BASE_URL: baseUrl },
  );

  assert.deepEqual(result, { success: true, data: { totalUrls: 2 } });
  assert.deepEqual(request, {
    method: "POST",
    url: "/api/v1/sitemap/full",
    apiKey: "sk_test",
    body: { url: "https://example.com", maxUrls: 200 },
  });
});

test("runs as a GitHub Action and writes outputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sitemapkit-action-"));
  const outputFile = join(directory, "result.json");
  const githubOutput = join(directory, "github-output");

  await runAction({
    INPUT_API_KEY: "sk_test",
    INPUT_COMMAND: "full",
    INPUT_URL: "https://example.com",
    INPUT_MAX_URLS: "200",
    INPUT_OUTPUT_FILE: outputFile,
    SITEMAPKIT_API_BASE_URL: baseUrl,
    GITHUB_OUTPUT: githubOutput,
  });

  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")), {
    success: true,
    data: { totalUrls: 2 },
  });
  assert.equal(
    await readFile(githubOutput, "utf8"),
    `result-file=${outputFile}\ntotal-urls=2\n`,
  );
});

test("requires an API key", async () => {
  await assert.rejects(
    requestSitemapKit({ command: "discover", url: "https://example.com" }, {}),
    /Set SITEMAPKIT_API_KEY/,
  );
});

test("extracts a sitemap index locally without an API key", async () => {
  const result = await runSitemapCommand(
    { command: "extract", url: `${baseUrl}/sitemap-index.xml`, maxUrls: 10 },
    {},
  );

  assert.deepEqual(result, {
    success: true,
    data: {
      sitemapUrl: `${baseUrl}/sitemap-index.xml`,
      sitemapsProcessed: 2,
      totalUrls: 2,
      truncated: false,
      urls: [
        { loc: "https://example.com/", lastmod: "2026-09-01" },
        { loc: "https://example.com/search?a=1&b=2" },
      ],
    },
  });
});

test("decompresses a gzipped sitemap locally", async () => {
  const result = await runSitemapCommand(
    { command: "extract", url: `${baseUrl}/pages.xml.gz` },
    {},
  );

  assert.equal(result.data.totalUrls, 1);
  assert.deepEqual(result.data.urls, [{ loc: "https://example.com/compressed" }]);
});

test("runs when invoked through an npm-style symlink", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sitemapkit-cli-"));
  const executable = join(directory, "sitemapkit");
  await symlink(new URL("../bin/sitemapkit.js", import.meta.url), executable);

  await assert.rejects(
    execFileAsync(executable, ["discover", "https://example.com"], {
      env: { PATH: process.env.PATH },
    }),
    (error) => {
      assert.match(error.stderr, /Set SITEMAPKIT_API_KEY/);
      return true;
    },
  );
});
