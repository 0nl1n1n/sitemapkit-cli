# SitemapKit CLI

Discover XML sitemaps, parse nested sitemap indexes, and extract page URLs without writing a crawler. SitemapKit CLI works in local shell scripts, CI pipelines, and GitHub Actions for SEO audits, URL inventories, indexing checks, and content workflows.

It uses the [SitemapKit sitemap extraction API](https://sitemapkit.com/docs). Create an API key at [sitemapkit.com/register](https://sitemapkit.com/register); the free plan includes 100 requests per month.

## Requirements

- Node.js 18 or newer
- A SitemapKit API key

## Run it

```bash
export SITEMAPKIT_API_KEY=sk_live_...
npx github:0nl1n1n/sitemapkit-cli full https://example.com
```

Extract one known sitemap:

```bash
npx github:0nl1n1n/sitemapkit-cli extract https://example.com/sitemap.xml --max-urls 5000
```

Find sitemap files without extracting their URLs:

```bash
npx github:0nl1n1n/sitemapkit-cli discover https://example.com
```

The command writes the API response as JSON to standard output. Errors go to standard error and return a non-zero exit code, so the CLI works in shell pipelines and CI jobs.

## Try the browser tools

You can test the same workflow before adding an API key:

- [Find sitemap files for a domain](https://sitemapkit.com/sitemap-finder)
- [Count and extract URLs from a sitemap](https://sitemapkit.com/tools/sitemap-extractor)
- [Validate sitemap XML and `lastmod` dates](https://sitemapkit.com/tools/sitemap-checker)

The finder starts from a domain. The extractor and checker accept a sitemap URL or pasted XML.

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
sitemapkit full https://example.com
```

## Commands

```text
sitemapkit discover <domain-url>
sitemapkit extract <sitemap-url> [--max-urls <1-50000>]
sitemapkit full <domain-url> [--max-urls <1-50000>]
```

Set `SITEMAPKIT_API_BASE_URL` only when testing against another compatible API origin. It defaults to `https://api.sitemapkit.com`.

## API limits

| Plan | API requests/month | URLs per extraction |
|------|-------------------:|--------------------:|
| Free | 100 | 1,000 |
| Starter | 5,000 | 10,000 |
| Pro | 50,000 | 50,000 |

See current API and monitoring allowances on the [pricing page](https://sitemapkit.com/pricing).

## License

MIT
