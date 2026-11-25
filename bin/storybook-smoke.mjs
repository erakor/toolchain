#!/usr/bin/env node
// Opens every story of a built Storybook in Chromium and fails if one throws or shows Storybook's
// error screen. Run it from the package after building:
//
//   pnpm build-storybook && erakor-storybook-smoke [dir]   # dir defaults to storybook-static
//
// Playwright is resolved from the calling package, not from here, so its version matches the
// Chromium that the package's own `playwright install` put on the machine.
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join, normalize, resolve } from 'node:path'

const dir = resolve(process.argv[2] ?? 'storybook-static')
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright')

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  )
  try {
    const body = await readFile(join(dir, path === '/' ? 'index.html' : path))
    res
      .writeHead(200, {
        'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
        // the build doesn't change during a run, so pages may reuse what they fetched
        'cache-control': 'max-age=3600',
      })
      .end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const base = `http://127.0.0.1:${server.address().port}`

const { entries } = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'))
const ids = Object.values(entries)
  .filter((entry) => entry.type === 'story')
  .map((entry) => entry.id)

// A few pages in one context share the HTTP cache, so the preview bundle is fetched once per
// page, not once per story.
const browser = await chromium.launch()
const context = await browser.newContext()
const failed = new Map()
// the first reason a story fails is the one reported
const fail = (id, reason) => failed.has(id) || failed.set(id, reason)
const queue = [...ids]
async function worker() {
  const page = await context.newPage()
  let id
  page.on('pageerror', (error) => fail(id, error.message))
  while ((id = queue.shift()) !== undefined) {
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`)
    const settled = await page
      // `sb-show-main` can already be set while the story is still preparing, so wait for
      // the preparing class to go too, or a story that throws on render would pass
      .waitForFunction(
        () =>
          /sb-show-(main|errordisplay|nopreview)/.test(document.body.className) &&
          !/sb-show-preparing-/.test(document.body.className),
        null,
        { timeout: 15_000 },
      )
      .then(() => true)
      .catch(() => false)
    if (!settled) {
      fail(id, 'did not render within 15s')
    } else if (await page.evaluate(() => !document.body.classList.contains('sb-show-main'))) {
      const message = await page.textContent('#error-message').catch(() => null)
      fail(id, message?.trim() || 'error screen')
    }
  }
}
await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker))
await browser.close()
server.close()

console.log(`${ids.length - failed.size}/${ids.length} stories rendered`)
if (ids.length === 0) {
  console.error(`no stories in ${join(dir, 'index.json')}`)
  process.exit(1)
}
if (failed.size > 0) {
  for (const [id, reason] of failed) console.error(`${id}: ${reason}`)
  process.exit(1)
}
