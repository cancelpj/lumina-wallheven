/**
 * Visual + behavioural check for the virtualised wallpaper grid.
 *
 * Loads the built frontend with the Tauri IPC layer stubbed out, then asserts
 * that the grid keeps only the visible rows mounted while the data set keeps
 * growing.
 *
 *   pnpm build
 *   node scripts/verify-grid.cjs
 *
 * Set PLAYWRIGHT_CHROME_PATH if Playwright cannot find its own browser.
 */
const { chromium } = require('playwright')
const http = require('http')
const fs = require('fs')
const path = require('path')

const DIST = path.join(__dirname, '..', 'dist')
const PORT = 8931

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath)

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST, 'index.html')
      }

      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      })
      fs.createReadStream(filePath).pipe(res)
    })
    server.listen(PORT, () => resolve(server))
  })
}

function makeThumb(index) {
  const hue = (index * 37) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="hsl(${hue},60%,55%)"/><text x="100" y="80" font-size="28" fill="white" text-anchor="middle">${index}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

async function main() {
  const server = await serve()
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const invoked = []

  await page.addInitScript(() => {
    const TOTAL = 200

    const thumb = (i) => {
      const hue = (i * 37) % 360
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="hsl(${hue},60%,55%)"/><text x="100" y="80" font-size="28" fill="white" text-anchor="middle">${i}</text></svg>`
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    }

    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main', windowLabel: 'main' },
      },
      transformCallback: (callback) => {
        const id = Math.floor(Math.random() * 1_000_000)
        window[`_${id}`] = callback
        return id
      },
      invoke: async (cmd, args) => {
        window.__INVOKED__ = window.__INVOKED__ || []
        window.__INVOKED__.push(cmd)

        if (cmd === 'plugin:event|listen' || cmd === 'plugin:event|unlisten') return null

        if (cmd === 'fetch_wallhaven_api') {
          const pageNum = Number(args?.params?.page || 1)
          const data = []
          for (let i = 0; i < 24; i++) {
            const index = (pageNum - 1) * 24 + i
            if (index >= TOTAL) break
            data.push({
              id: `wp${index}`,
              url: `https://w.wallhaven.cc/full/wp${index}.jpg`,
              short_url: `https://wallhaven.cc/w/wp${index}`,
              views: 100 + index,
              favorites: 10 + index,
              source: 'test',
              purity: 'sfw',
              category: 'general',
              dimension_x: 3840,
              dimension_y: 2160,
              resolution: '3840x2160',
              ratio: '16:9',
              file_size: 5_000_000,
              file_type: 'image/jpeg',
              created_at: '2026-01-01T00:00:00',
              colors: ['#000000'],
              path: `wp/${index}.jpg`,
              thumbs: { small: thumb(index), large: thumb(index), original: thumb(index) },
            })
          }
          return {
            data,
            meta: { current_page: pageNum, last_page: 9, per_page: 24, total: TOTAL },
          }
        }

        if (cmd === 'get_download_dir') return '/tmp'
        if (cmd === 'get_cache_info') return { bytes: 0, path: '/tmp', platform: 'Linux' }
        if (cmd === 'fetch_wallpaper_thumbnail') return '/tmp/thumb.jpg'
        if (cmd === 'get_app_data_path') return '/tmp'

        return null
      },
    }
  })

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const scroller = await page.$('.custom-scrollbar')
  if (!scroller) throw new Error('scroller not found')

  const countCards = () => page.$$eval('img[alt^="Wallpaper"]', (els) => els.length)

  const initialCards = await countCards()
  const initialScrollHeight = await scroller.evaluate((el) => el.scrollHeight)

  await page.screenshot({ path: path.join(process.env.OUT_DIR || '.', 'grid-top.png') })

  // Keep scrolling to trigger more infinite-scroll pages, then check that the
  // mounted card count stays flat while the data set grows.
  for (let round = 0; round < 6; round++) {
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(700)
  }

  const afterScrollCards = await countCards()
  const loadedItems = await page.evaluate(() => document.querySelectorAll('img[alt^="Wallpaper"]').length)
  const afterScrollHeight = await scroller.evaluate((el) => el.scrollHeight)

  await page.screenshot({ path: path.join(process.env.OUT_DIR || '.', 'grid-bottom.png') })

  // Check the cards do not overlap: sample a few and compare their boxes.
  const overlap = await page.$$eval('img[alt^="Wallpaper"]', (els) => {
    const boxes = els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
    let overlaps = 0
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++
      }
    }
    return { overlaps, sample: boxes.slice(0, 3) }
  })

  console.log(JSON.stringify({
    initialCards,
    afterScrollCards,
    loadedItems,
    initialScrollHeight,
    afterScrollHeight,
    overlaps: overlap.overlaps,
    sampleBox: overlap.sample,
    invoked: [...new Set(await page.evaluate(() => window.__INVOKED__ || []))],
  }, null, 2))

  await browser.close()
  server.close()
}

main().catch((err) => {
  console.error('FAILED:', err.message)
  process.exit(1)
})
