// E2E-проверка без реальных ключей: ответы API подменяются (page.route), браузер настоящий.
// Запуск: npm run build && node tests/e2e.mjs <папка-с-тестовыми-файлами> [providerId ...]
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { mocks } from './mocks.mjs'

const fixtures = resolve(process.argv[2] ?? 'fixtures')
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
const cases = Object.entries(mocks).filter(([id]) => !only.length || only.includes(id))

for (const [id, mock] of cases) {
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
    await page.addInitScript(([id, key]) => {
      localStorage.setItem('bbt:prefs', JSON.stringify({ provider: id, prepare: 'mp3', corsProxy: '', useProxyFor: {}, theme: 'light' }))
      localStorage.setItem(`bbt:key:${id}`, JSON.stringify(key))
    }, [id, mock.key ?? 'test-key'])
    await page.goto(url)
    await page.setInputFiles('input[type=file]', join(fixtures, file))
    await page.getByText(/^\d+:\d\d$/).first().waitFor({ timeout: 20000 })
    await page.getByRole('button', { name: /Распознать через/ }).click()
    const ok = await Promise.race([
      page.getByText('Результат', { exact: true }).waitFor({ timeout: 180000 }).then(() => true),
      page.getByText('Не получилось').waitFor({ timeout: 180000 }).then(() => false),
    ])
    const text = ok ? await page.locator('textarea[aria-label="Текст транскрибации"]').inputValue() : await page.locator('[role=alert]').innerText()
    const check = ok && mock.expect ? mock.expect({ text, calls }) : ok
    const status = check === true ? 'PASS' : 'FAIL'
    if (status === 'FAIL') failed++
    console.log(`${status} ${id} ${file}: ${calls.length} req, text=${JSON.stringify(text.slice(0, 120))}${typeof check === 'string' ? ' — ' + check : ''}`)
    if (errors.length) console.log('  page errors:', errors)
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${id}-${file}.png`, fullPage: true })
    await page.close()
  }
}
await browser.close()
server.close()
process.exit(failed ? 1 : 0)
