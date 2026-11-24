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

const dir = resolve(process.argv[2] ?? process.env.STORYBOOK_DIR ?? 'storybook-static')
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
      .writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
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

const browser = await chromium.launch()
const failed = new Map()
const fail = (id, reason) => failed.set(id, [...(failed.get(id) ?? []), reason])
for (const id of ids) {
  const page = await browser.newPage()
  page.on('pageerror', (error) => fail(id, error.message))
  await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`)
  const settled = await page
    .waitForFunction(
      () => /sb-show-(main|errordisplay|nopreview)/.test(document.body.className),
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
  await page.close()
}
await browser.close()
server.close()

console.log(`${ids.length - failed.size}/${ids.length} stories rendered`)
if (ids.length === 0) {
  console.error(`no stories in ${join(dir, 'index.json')}`)
  process.exit(1)
}
if (failed.size > 0) {
  for (const [id, reasons] of failed) console.error(`${id}: ${reasons.join('; ')}`)
  process.exit(1)
}
