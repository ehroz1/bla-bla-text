// Regenerates the README screenshots in docs/assets/{en,ru} from the production build.
// Usage: npm run build && npm run test:fixtures && node scripts/screenshots.mjs
// The transcript in result.png comes from a mocked API response (no real API key is used).
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

const dist = resolve('dist')
const assets = resolve('docs/assets')
const audio = resolve('tests/fixtures/short.wav')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const server = createServer(async (req, res) => {
  const p = join(dist, new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html'))
  try {
    res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'application/octet-stream' })
    res.end(await readFile(p))
  } catch {
    res.writeHead(404).end()
  }
}).listen(0)
const url = `http://127.0.0.1:${server.address().port}/`

const sample = (w) => [
  { start: '00:00', end: '00:04', speaker: `${w} 1`, text: 'Коллеги, привет! Давайте быстро пройдёмся по sprint review.' },
  { start: '00:04', end: '00:09', speaker: `${w} 2`, text: 'Да, по API всё готово, pull request уже на ревью.' },
  { start: '00:09', end: '00:13', speaker: `${w} 1`, text: 'Отлично. Тогда deadline оставляем на пятницу?' },
  { start: '00:13', end: '00:16', speaker: `${w} 2`, text: 'Sure, успеваем.' },
]

const browser = await chromium.launch({ args: ['--disable-gpu', '--no-sandbox'] })

async function page(lang, theme, viewport, provider = 'groq', withKey = false) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  await p.route('https://fonts.googleapis.com/**', (r) => r.abort())
  await p.addInitScript(
    ([lang, theme, provider, withKey]) => {
      localStorage.setItem('bbt:prefs', JSON.stringify({ provider, prepare: 'mp3', corsProxy: '', useProxyFor: {}, theme, lang }))
      if (withKey) localStorage.setItem(`bbt:key:${provider}`, JSON.stringify('demo-key-not-real'))
    },
    [lang, theme, provider, withKey],
  )
  return p
}

for (const lang of ['en', 'ru']) {
  const out = `${assets}/${lang}`
  await mkdir(out, { recursive: true })
  // 1. Main screen with a file loaded
  {
    const p = await page(lang, 'light', { width: 1280, height: 860 })
    await p.goto(url)
    await p.setInputFiles('input[type=file]', audio)
    await p.getByText(/^\d+:\d\d$/).first().waitFor()
    await p.screenshot({ path: `${out}/main.png` })
    await p.close()
  }
  // 2. Result view (mocked Gemini response)
  {
    const p = await page(lang, 'light', { width: 1280, height: 900 }, 'gemini', true)
    await p.route('https://generativelanguage.googleapis.com/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ language: 'ru', segments: sample(lang === 'ru' ? 'Спикер' : 'Speaker') }) }] } }] }),
      }),
    )
    await p.goto(url)
    await p.setInputFiles('input[type=file]', audio)
    await p.getByText(/^\d+:\d\d$/).first().waitFor()
    await p.getByRole('button', { name: /Распознать через|Transcribe with/ }).click()
    const card = p.locator('div.scroll-mt-20')
    await card.waitFor({ timeout: 120000 })
    await p.getByRole('tab', { name: /^(Таймкоды|Timestamps)$/ }).click()
    await card.screenshot({ path: `${out}/result.png` })
    await p.close()
  }
  // 3. Services & limits, dark theme
  {
    const p = await page(lang, 'dark', { width: 1280, height: 860 })
    await p.goto(url + '#limits')
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${out}/limits-dark.png` })
    await p.close()
  }
  // 4. Mobile
  {
    const p = await page(lang, 'light', { width: 390, height: 844 })
    await p.goto(url)
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${out}/mobile.png` })
    await p.close()
  }
}

await browser.close()
server.close()
console.log('Screenshots written to', assets)
