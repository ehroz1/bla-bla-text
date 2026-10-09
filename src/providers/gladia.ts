import { poll, requestJson } from './http'
import { segmentsToText, speakerName } from './segments'
import type { Provider } from './types'

const BASE = 'https://api.gladia.io/v2'

const LANGS: Record<string, string[]> = {
  'ru-en': ['ru', 'en'],
  'kk-ru': ['kk', 'ru'],
  'kk-ru-en': ['kk', 'ru', 'en'],
  ru: ['ru'],
  en: ['en'],
  kk: ['kk'],
}

interface GladiaJob {
  id: string
  status: 'queued' | 'processing' | 'done' | 'error'
  error_code?: number
  result?: {
    metadata?: { audio_duration?: number }
    transcription?: {
      full_transcript: string
      languages?: string[]
      utterances?: { start: number; end: number; text: string; language?: string; speaker?: number }[]
    }
  }
}

export const gladia: Provider = {
  id: 'gladia',
  name: 'Gladia',
  vendor: 'Gladia (Франция)',
  tagline: 'Явный code-switching для RU+EN и KZ+RU: каждая фраза помечается своим языком. €50 на старте.',
  description:
    'Gladia — французский API на базе доработанного Whisper (модель Solaria-1, 100+ языков, включая казахский). Главная фишка — режим code-switching: вы указываете языки разговора (например, ru+en или kk+ru), и сервис определяет язык каждой фразы. Спикеры, словарь терминов. Бесплатно — разовые €50 кредитов.',
  langs: { ru: 2, en: 3, kk: 2, mix: 3 },
  free: '€50 при регистрации',
  limits: ['Free: разовые €50 кредитов', 'До 3 одновременных задач', 'Файл до 1 ГБ и до 135 минут (длиннее — режем на части)'],
  pricing: 'Starter ≈ $0,61/ч',
  card: 'не нужна',
  keyUrl: 'https://app.gladia.io/apikeys',
  signupUrl: 'https://app.gladia.io/auth/signup',
  docsUrl: 'https://docs.gladia.io/chapters/pre-recorded-stt/getting-started',
  keySteps: [
    'Зарегистрируйтесь на https://app.gladia.io (проще всего через Google).',
    'Откройте https://app.gladia.io/apikeys — ключ по умолчанию уже есть, или нажмите «Generate new API key».',
    'Скопируйте ключ и вставьте ниже.',
  ],
  keyPlaceholder: 'ключ Gladia (UUID)',
  maxBytes: 1000 * 1024 ** 2,
  maxChunkSeconds: 130 * 60,
  cors: 'unknown',
  tags: ['ru-en', 'kk', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'languages',
      label: 'Языки разговора',
      default: 'ru-en',
      options: [
        { value: 'ru-en', label: 'Русский + английский' },
        { value: 'kk-ru', label: 'Казахский + русский' },
        { value: 'kk-ru-en', label: 'Казахский + русский + английский' },
        { value: 'ru', label: 'Только русский' },
        { value: 'en', label: 'Только английский' },
        { value: 'kk', label: 'Только казахский' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', default: true },
    {
      kind: 'text',
      id: 'vocabulary',
      label: 'Словарь терминов',
      hint: 'Через запятую — имена, бренды, жаргон.',
      default: '',
      placeholder: 'Kaspi, Айгерим, deploy, Jira',
    },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const auth = { 'x-gladia-key': ctx.apiKey }
    ctx.onStatus('Загружаю файл…')
    const form = new FormData()
    form.append('audio', file, fileName)
    const { data: up } = await requestJson<{ audio_url: string }>(ctx, `${BASE}/upload`, { method: 'POST', headers: auth, body: form })

    const languages = LANGS[String(s.languages)] ?? LANGS['ru-en']
    const vocab = String(s.vocabulary || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    const body: Record<string, unknown> = {
      audio_url: up.audio_url,
      language_config: { languages, code_switching: languages.length > 1 },
      diarization: !!s.diarize,
    }
    if (vocab.length) {
      body.custom_vocabulary = true
      body.custom_vocabulary_config = { vocabulary: vocab }
    }
    const { data: job } = await requestJson<{ id: string }>(ctx, `${BASE}/pre-recorded`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const done = await poll<GladiaJob>(ctx, async () => {
      const { data } = await requestJson<GladiaJob>(ctx, `${BASE}/pre-recorded/${job.id}`, { headers: auth })
      if (data.status === 'error') throw new Error(`Gladia вернула ошибку (код ${data.error_code ?? '—'})`)
      return { done: data.status === 'done', value: data, status: data.status }
    })
    const tr = done.result?.transcription
    const segments = (tr?.utterances ?? []).map((u) => ({
      start: u.start,
      end: u.end,
      text: u.text.trim(),
      speaker: s.diarize ? speakerName(u.speaker) : undefined,
    }))
    return {
      text: s.diarize && segments.length ? segmentsToText(segments) : (tr?.full_transcript ?? '').trim(),
      segments,
      language: tr?.languages?.join(', '),
      duration: done.result?.metadata?.audio_duration,
      raw: done,
    }
  },
  async checkLimits(ctx) {
    const { data } = await requestJson<{ items?: unknown[]; total?: number }>(ctx, `${BASE}/pre-recorded?limit=1`, {
      headers: { 'x-gladia-key': ctx.apiKey },
    })
    return {
      items: [
        { label: 'Ключ', value: 'работает ✓' },
        ...(data.total != null ? [{ label: 'Всего расшифровок', value: String(data.total) }] : []),
      ],
      note: 'Остаток кредитов — в кабинете app.gladia.io → Billing.',
    }
  },
}
