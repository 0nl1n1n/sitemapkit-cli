# SitemapKit CLI

Extract URLs from XML sitemaps without writing a crawler. The CLI can discover sitemap files, parse one sitemap recursively, or run both steps for a domain.

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

## License

MIT
