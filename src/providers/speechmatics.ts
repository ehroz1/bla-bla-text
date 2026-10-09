import { poll, requestJson } from './http'
import { segmentsToText, speakerName } from './segments'
import type { Provider, Segment } from './types'

const REGIONS: Record<string, string> = {
  eu: 'https://eu1.asr.api.speechmatics.com/v2',
  us: 'https://us1.asr.api.speechmatics.com/v2',
}

interface JsonV2 {
  metadata?: { transcription_config?: { language?: string } }
  results: {
    type: 'word' | 'punctuation' | 'speaker_change'
    start_time: number
    end_time: number
    is_eos?: boolean
    attaches_to?: 'previous' | 'next' | 'none' | 'both'
    alternatives?: { content: string; language?: string; speaker?: string }[]
  }[]
}

function toSegments(data: JsonV2, diarize: boolean): Segment[] {
  const out: Segment[] = []
  let cur: Segment | null = null
  for (const r of data.results ?? []) {
    const alt = r.alternatives?.[0]
    if (!alt) continue
    const speaker = diarize ? speakerName(alt.speaker, 1) : undefined
    if (r.type === 'word') {
      if (cur && cur.speaker !== speaker) {
        out.push(cur)
        cur = null
      }
      if (!cur) cur = { start: r.start_time, end: r.end_time, text: alt.content, speaker }
      else cur.text += ' ' + alt.content
      cur.end = r.end_time
    } else if (r.type === 'punctuation' && cur) {
      cur.text += r.attaches_to === 'next' ? ' ' + alt.content : alt.content
      if (r.is_eos) {
        out.push(cur)
        cur = null
      }
    }
  }
  if (cur) out.push(cur)
  return out
}

export const speechmatics: Provider = {
  id: 'speechmatics',
  name: 'Speechmatics',
  vendor: 'Speechmatics (Великобритания)',
  tagline: 'Отдельная модель для речи вперемешку: Melia-1 сама переключается между RU и EN посреди фразы.',
  description:
    'Speechmatics — британский enterprise-распознаватель. Модель Melia-1 сделана именно для мультиязычных записей: язык может меняться посреди разговора, каждое слово помечается своим языком. Для чисто русских или английских записей есть классические Standard/Enhanced. Казахского нет. $100 бесплатных кредитов при регистрации, карта не нужна.',
  langs: { ru: 3, en: 3, kk: 0, mix: 3 },
  free: '$100 при регистрации',
  limits: [
    'Free: разовые $100 кредитов (≈ 250–750 часов в зависимости от модели), без карты',
    'Файл до 1 ГБ, до 2 часов на Free',
    'Melia-1: только регионы EU/US, без словаря и confidence',
  ],
  pricing: 'Melia-1 ≈ $0,13/ч, Standard ≈ $0,24/ч, Enhanced ≈ $0,40/ч',
  card: 'не нужна',
  keyUrl: 'https://portal.speechmatics.com/settings/api-keys',
  signupUrl: 'https://portal.speechmatics.com/signup',
  docsUrl: 'https://docs.speechmatics.com/speech-to-text/batch/quickstart',
  keySteps: [
    'Зарегистрируйтесь на https://portal.speechmatics.com/signup (почта или Google).',
    'Откройте Settings → API Keys: https://portal.speechmatics.com/settings/api-keys',
    'Нажмите «Create API Key», скопируйте ключ и вставьте ниже.',
  ],
  keyPlaceholder: 'ключ Speechmatics',
  maxBytes: 1000 * 1024 ** 2,
  maxChunkSeconds: 2 * 3600,
  cors: 'unknown',
  tags: ['ru-en', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'mode',
      label: 'Модель и язык',
      default: 'melia',
      options: [
        { value: 'melia', label: 'Melia-1 — RU + EN вперемешку (рекомендуется)' },
        { value: 'ru-enhanced', label: 'Enhanced — только русский, максимум точности' },
        { value: 'en-enhanced', label: 'Enhanced — только английский' },
        { value: 'ru-standard', label: 'Standard — русский, дешевле' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', default: true },
    {
      kind: 'select',
      id: 'region',
      label: 'Регион',
      default: 'eu',
      options: [
        { value: 'eu', label: 'Европа (eu1)' },
        { value: 'us', label: 'США (us1)' },
      ],
    },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const base = REGIONS[String(s.region)] ?? REGIONS.eu
    const mode = String(s.mode || 'melia')
    const tc: Record<string, unknown> =
      mode === 'melia'
        ? { model: 'melia-1', language: 'multi', language_hints: ['ru', 'en'] }
        : { language: mode.slice(0, 2), operating_point: mode.endsWith('enhanced') ? 'enhanced' : 'standard', enable_entities: true }
    if (s.diarize) tc.diarization = 'speaker'
    const form = new FormData()
    form.append('data_file', file, fileName)
    form.append('config', JSON.stringify({ type: 'transcription', transcription_config: tc }))
    const auth = { Authorization: `Bearer ${ctx.apiKey}` }

    ctx.onStatus('Загружаю файл…')
    const { data: job } = await requestJson<{ id: string }>(ctx, `${base}/jobs/`, { method: 'POST', headers: auth, body: form })
    await poll(ctx, async () => {
      const { data } = await requestJson<{ job: { status: string; errors?: { message: string }[] } }>(ctx, `${base}/jobs/${job.id}`, {
        headers: auth,
      })
      const st = data.job.status
      if (st === 'rejected' || st === 'deleted' || st === 'expired')
        throw new Error(`Speechmatics отклонил задачу: ${data.job.errors?.map((e) => e.message).join('; ') || st}`)
      return { done: st === 'done', status: st }
    })
    const { data } = await requestJson<JsonV2>(ctx, `${base}/jobs/${job.id}/transcript?format=json-v2`, { headers: auth })
    const segments = toSegments(data, !!s.diarize)
    return { text: segmentsToText(segments), segments, language: data.metadata?.transcription_config?.language, raw: data }
  },
  async checkLimits(ctx) {
    const since = new Date()
    since.setDate(1)
    const { data } = await requestJson<{ summary?: { mode: string; type: string; count: number; duration_hrs: number; operating_point?: string }[] }>(
      ctx,
      `${REGIONS.eu}/usage?since=${since.toISOString().slice(0, 10)}`,
      { headers: { Authorization: `Bearer ${ctx.apiKey}` } },
    )
    const rows = (data.summary ?? []).filter((r) => r.count > 0)
    return {
      items: [
        { label: 'Ключ', value: 'работает ✓' },
        ...(rows.length
          ? rows.map((r) => ({
              label: `В этом месяце: ${r.type} ${r.mode}${r.operating_point ? ' ' + r.operating_point : ''}`,
              value: `${r.duration_hrs.toFixed(2)} ч · ${r.count} задач`,
            }))
          : [{ label: 'В этом месяце', value: '0 ч' }]),
      ],
      note: 'Остаток кредитов — в портале: portal.speechmatics.com → Usage/Billing.',
    }
  },
}
