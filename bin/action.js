#!/usr/bin/env node

import { appendFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArguments, requestSitemapKit } from "./sitemapkit.js";

export function parseActionInputs(env = process.env) {
  const command = env.INPUT_COMMAND || "full";
  const url = env.INPUT_URL;
  const maxUrls = env.INPUT_MAX_URLS;
  const argv = [command, url];
  if (maxUrls) argv.push("--max-urls", maxUrls);
  return parseArguments(argv);
}

async function setOutput(name, value, env = process.env) {
  if (!env.GITHUB_OUTPUT) return;
  await appendFile(env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export async function runAction(env = process.env) {
  const input = parseActionInputs(env);
  const result = await requestSitemapKit(input, {
    SITEMAPKIT_API_KEY: env.INPUT_API_KEY,
    SITEMAPKIT_API_BASE_URL: env.SITEMAPKIT_API_BASE_URL,
  });
  const outputFile = env.INPUT_OUTPUT_FILE || "sitemapkit-result.json";
  await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`);
  await setOutput("result-file", outputFile, env);
  await setOutput("total-urls", result?.data?.totalUrls ?? 0, env);
  return { result, outputFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAction().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
