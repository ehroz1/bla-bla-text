import { sleep } from '@/lib/utils'
import type { ProviderContext } from './types'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const RATE_HEADER = /ratelimit|rate-limit|quota|remaining|credits|character-cost|request-id/i

export function pickRateHeaders(res: Response): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  res.headers.forEach((v, k) => {
    if (RATE_HEADER.test(k)) out[k] = v
  })
  return Object.keys(out).length ? out : undefined
}

function extractMessage(body: unknown): string | undefined {
  if (!body) return undefined
  if (typeof body === 'string') return body.slice(0, 400)
  const b = body as Record<string, unknown>
  const err = b.error as Record<string, unknown> | string | undefined
  if (typeof err === 'string') return err
  if (err && typeof err.message === 'string') return err.message
  const detail = b.detail as Record<string, unknown> | string | undefined
  if (typeof detail === 'string') return detail
  if (detail && typeof detail.message === 'string') return detail.message
  if (Array.isArray(b.detail)) return JSON.stringify(b.detail).slice(0, 400)
  for (const k of ['message', 'err_msg', 'error_message', 'reason', 'msg']) {
    if (typeof b[k] === 'string') return b[k] as string
  }
  return JSON.stringify(body).slice(0, 400)
}

function humanize(status: number, msg?: string): string {
  const base = msg ? `: ${msg}` : ''
  switch (status) {
    case 400:
      return `Сервис отклонил запрос (400)${base}`
    case 401:
      return `Ключ не подходит (401) — проверьте, что скопировали его целиком${base}`
    case 402:
      return `Закончились кредиты/баланс (402)${base}`
    case 403:
      return `Доступ запрещён (403) — у ключа нет прав, или сервис недоступен из вашей страны${base}`
    case 404:
      return `Не найдено (404) — модель или адрес API изменились${base}`
    case 413:
      return `Файл слишком большой для этого сервиса (413)${base}`
    case 415:
      return `Формат файла не поддерживается (415)${base}`
    case 429:
      return `Превышен лимит запросов (429) — подождите или смените сервис${base}`
    default:
      return status >= 500 ? `Ошибка на стороне сервиса (${status})${base}` : `Ошибка ${status}${base}`
  }
}

/** fetch + разбор ошибок + понятные сообщения на русском. */
export async function request(
  ctx: Pick<ProviderContext, 'fetch' | 'signal'>,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let res: Response
  try {
    res = await ctx.fetch(url, { ...init, signal: ctx.signal })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    throw new Error(
      'Браузер не смог отправить запрос: нет сети, блокировщик рекламы/VPN, или сервис запрещает прямые запросы из браузера (CORS). ' +
        'Включите CORS-прокси в «Настройках» для этого сервиса.',
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let body: unknown = text
    try {
      body = JSON.parse(text)
    } catch {
      /* not json */
    }
    throw new ApiError(humanize(res.status, extractMessage(body)), res.status, body)
  }
  return res
}

export async function requestJson<T = unknown>(
  ctx: Pick<ProviderContext, 'fetch' | 'signal'>,
  url: string,
  init: RequestInit = {},
): Promise<{ data: T; res: Response }> {
  const res = await request(ctx, url, init)
  const text = await res.text()
  let data: T
  try {
    data = (text ? JSON.parse(text) : {}) as T
  } catch {
    data = text as unknown as T
  }
  return { data, res }
}

/** Опрос асинхронной задачи до готовности. */
export async function poll<T>(
  ctx: Pick<ProviderContext, 'signal' | 'onStatus'>,
  fn: () => Promise<{ done: boolean; value?: T; status?: string }>,
  { interval = 2500, timeoutMs = 3 * 60 * 60 * 1000 } = {},
): Promise<T> {
  const started = Date.now()
  for (;;) {
    const r = await fn()
    if (r.done) return r.value as T
    const secs = Math.round((Date.now() - started) / 1000)
    ctx.onStatus(`Сервис обрабатывает файл… ${r.status ? `(${r.status}) ` : ''}${secs} с`)
    if (Date.now() - started > timeoutMs) throw new Error('Сервис слишком долго обрабатывает файл — попробуйте позже')
    await sleep(interval, ctx.signal)
  }
}

/** Прокси: https://proxy.example.workers.dev/https://api.x.com/... */
export function makeFetch(proxy?: string): typeof fetch {
  const base = proxy?.trim().replace(/\/+$/, '')
  if (!base) return (input, init) => fetch(input, init)
  return (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return fetch(`${base}/${url}`, init)
  }
}

export function langOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' && v && v !== 'auto' ? v : undefined
}
