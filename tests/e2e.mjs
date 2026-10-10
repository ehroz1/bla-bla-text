// E2E-проверка без реальных ключей: ответы API подменяются (page.route), браузер настоящий.
// Run: npm run test:fixtures && npm run build && npm run test:e2e   (optionally: node tests/e2e.mjs tests/fixtures groq gemini)
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { mocks } from './mocks.mjs'

const fixtures = resolve(process.argv[2] ?? 'tests/fixtures')
const only = process.argv.slice(3)
const dist = resolve('dist')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' }
const server = createServer(async (req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'))
  try {
    res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'application/octet-stream' })
    res.end(await readFile(p))
  } catch {
    res.writeHead(404).end()
  }
}).listen(0)
const url = `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch({ args: ['--disable-gpu', '--no-sandbox'] })
let failed = 0
const cases = Object.entries(mocks).filter(([key]) => !only.length || only.includes(key) || only.includes(key.split('@')[0]))

for (const [key, mock] of cases) {
  // 'gemini@en' — тот же сервис, но интерфейс на английском
  const [id, lang = 'ru'] = key.split('@')
  for (const file of mock.files ?? ['short.wav']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const calls = []
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('https://fonts.googleapis.com/**', (r) => r.abort())
    await page.route(mock.match, async (route) => {
      const req = route.request()
      calls.push({ method: req.method(), url: req.url(), headers: req.headers(), size: req.postDataBuffer()?.length ?? 0 })
      await route.fulfill(await mock.respond(req, calls.length))
    })
    await page.addInitScript(([id, key, lang]) => {
      localStorage.setItem('bbt:prefs', JSON.stringify({ provider: id, prepare: 'mp3', corsProxy: '', useProxyFor: {}, theme: 'light', lang }))
      localStorage.setItem(`bbt:key:${id}`, JSON.stringify(key))
    }, [id, mock.key ?? 'test-key', lang])
    await page.goto(url)
    await page.setInputFiles('input[type=file]', join(fixtures, file))
    await page.getByText(/^\d+:\d\d$/).first().waitFor({ timeout: 20000 })
    await page.getByRole('button', { name: /Распознать через|Transcribe with/ }).click()
    const ok = await Promise.race([
      page.getByText(/^(Результат|Result)$/).waitFor({ timeout: 600000 }).then(() => true),
      page.getByText(/^(Не получилось|Something went wrong)$/).waitFor({ timeout: 600000 }).then(() => false),
    ])
    const text = ok ? await page.locator('textarea[aria-label="Текст транскрибации"], textarea[aria-label="Transcript text"]').inputValue() : await page.locator('[role=alert]').innerText()
    const check = ok && mock.expect ? mock.expect({ text, calls }) : ok
    const status = check === true ? 'PASS' : 'FAIL'
    if (status === 'FAIL') failed++
    console.log(`${status} ${key} ${file}: ${calls.length} req, text=${JSON.stringify(text.slice(0, 120))}${typeof check === 'string' ? ' — ' + check : ''}`)
    if (errors.length) console.log('  page errors:', errors)
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${key}-${file}.png`, fullPage: true })
    await page.close()
  }
}
await browser.close()
server.close()
process.exit(failed ? 1 : 0)
