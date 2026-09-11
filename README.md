# SitemapKit CLI

Parse XML sitemaps and nested sitemap indexes from the command line. The `extract` command runs locally without an account. Domain discovery and the combined `full` workflow use the SitemapKit API.

SitemapKit CLI works in shell scripts, CI pipelines, and GitHub Actions for URL inventories and content workflows.

## Requirements

- Node.js 18 or newer
- A SitemapKit API key for `discover`, `full`, and the GitHub Action

## Run it

Extract one known sitemap or sitemap index. This follows nested indexes up to five levels, decompresses `.xml.gz` responses, and needs no API key:

```bash
npx github:0nl1n1n/sitemapkit-cli extract https://example.com/sitemap.xml --max-urls 5000
```

To discover sitemap files from a domain, create a key at [sitemapkit.com/register](https://sitemapkit.com/register). The free API plan includes 100 requests per month.

```bash
export SITEMAPKIT_API_KEY=sk_live_...
npx github:0nl1n1n/sitemapkit-cli discover https://example.com
npx github:0nl1n1n/sitemapkit-cli full https://example.com
```

Each command writes JSON to standard output. Errors go to standard error and return a non-zero exit code, so the CLI works in shell pipelines and CI jobs.

Use `--format urls` with `extract` or `full` when a pipeline needs one URL per line instead of the full JSON response:

```bash
npx github:0nl1n1n/sitemapkit-cli extract https://example.com/sitemap.xml --format urls > urls.txt
```

## Try the browser tools

You can test the same workflow before adding an API key:

- [Find sitemap files for a domain](https://sitemapkit.com/sitemap-finder)
- [Count and extract URLs from a sitemap](https://sitemapkit.com/tools/sitemap-extractor)
- [Validate sitemap XML and `lastmod` dates](https://sitemapkit.com/tools/sitemap-checker)

The finder starts from a domain. The extractor and checker accept a sitemap URL or pasted XML.

To prepare or compare files locally:

- [Generate sitemap.xml from a URL list or CSV](https://sitemapkit.com/tools/sitemap-generator)
- [Split a sitemap at the 50,000 URL and 50 MB limits](https://sitemapkit.com/tools/sitemap-splitter)
- [Compare two XML sitemaps](https://sitemapkit.com/tools/sitemap-diff)

These tools run in the browser and do not require an API key.

## Monitor newly published pages

The CLI is intended for on-demand and CI runs. To keep a durable URL baseline, detect new pages automatically, and ping a signed webhook, use [SitemapKit Monitoring](https://sitemapkit.com/sitemap-monitoring).

The free plan includes one daily monitor. Paid plans add more websites, larger sitemaps, and checks as often as every hour. Webhook payloads and HMAC verification are documented in the [monitoring webhook guide](https://sitemapkit.com/sitemap-monitoring/webhooks).

## Use it in GitHub Actions

Add the API key as a repository secret named `SITEMAPKIT_API_KEY`, then run the extractor in a workflow:

```yaml
- name: Extract sitemap URLs
  id: sitemap
  uses: 0nl1n1n/sitemapkit-cli@v1
  with:
    api-key: ${{ secrets.SITEMAPKIT_API_KEY }}
    command: extract
    url: https://example.com/sitemap.xml
    max-urls: 5000

- name: Upload the URL inventory
  uses: actions/upload-artifact@v4
  with:
    name: sitemap-urls
    path: ${{ steps.sitemap.outputs.result-file }}
```

The action writes the full API response to `sitemapkit-result.json` by default. Its `total-urls` output contains the extracted URL count. Use `discover` to find sitemap files without extracting them, or `full` to discover and extract in one step.

## Install from source

```bash
git clone https://github.com/0nl1n1n/sitemapkit-cli.git
cd sitemapkit-cli
npm link
sitemapkit extract https://example.com/sitemap.xml
```

## Commands

```text
sitemapkit discover <domain-url>
sitemapkit extract <sitemap-url> [--max-urls <1-50000>] [--format <json|urls>]
sitemapkit full <domain-url> [--max-urls <1-50000>] [--format <json|urls>]
```

Set `SITEMAPKIT_API_BASE_URL` only when testing against another compatible API origin. It defaults to `https://api.sitemapkit.com`.

When `SITEMAPKIT_API_KEY` is set, `extract` uses the API as well. That route adds managed fetching for bot-protected sites. Leave the key unset to parse the sitemap locally.

## API limits

| Plan | API requests/month | URLs per extraction |
|------|-------------------:|--------------------:|
| Free | 100 | 1,000 |
| Starter | 5,000 | 10,000 |
| Pro | 50,000 | 50,000 |

See current API and monitoring allowances on the [pricing page](https://sitemapkit.com/pricing).

## License

MIT
