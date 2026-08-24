import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import http from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseArguments, requestSitemapKit } from "../bin/sitemapkit.js";

const execFileAsync = promisify(execFile);

let server;
let baseUrl;
let request;

before(async () => {
  server = http.createServer((incoming, response) => {
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

test("requires an API key", async () => {
  await assert.rejects(
    requestSitemapKit({ command: "discover", url: "https://example.com" }, {}),
    /Set SITEMAPKIT_API_KEY/,
  );
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
