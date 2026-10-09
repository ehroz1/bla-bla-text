import { poll, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'

const BASE = 'https://api.assemblyai.com/v2'

interface Transcript {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  error?: string
  text?: string
  language_code?: string
  audio_duration?: number
  words?: { text: string; start: number; end: number; speaker?: string | null }[]
  utterances?: { text: string; start: number; end: number; speaker: string }[]
}

export const assemblyai: Provider = {
  id: 'assemblyai',
  name: 'AssemblyAI',
  vendor: 'AssemblyAI',
  tagline: 'Universal: 99 языков, режим code-switching для RU+EN, спикеры, ключевые слова. $50 на старте.',
  description:
    'AssemblyAI — популярный американский API распознавания. Для русского используется модель Universal-2 (флагман Universal-3 Pro русский пока не поддерживает — включён режим «с откатом»). Есть явный режим code-switching: сервис определяет, где RU, а где EN. Спикеры, пунктуация, форматирование чисел. $50 бесплатных кредитов (≈ 300+ часов), без карты.',
  langs: { ru: 2, en: 3, kk: 0, mix: 2 },
  free: '$50 при регистрации',
  limits: [
    'Free: разовые $50 кредитов, без карты',
    'До 5 одновременных задач на бесплатном аккаунте',
    'Файл до 2,2 ГБ / 10 часов',
  ],
  pricing: 'Universal-2 ≈ $0,15/ч, дополнения (спикеры и т.п.) — отдельно',
  card: 'не нужна',
  keyUrl: 'https://www.assemblyai.com/dashboard/api-keys',
  signupUrl: 'https://www.assemblyai.com/dashboard/signup',
  docsUrl: 'https://www.assemblyai.com/docs/getting-started/transcribe-an-audio-file',
  keySteps: [
    'Зарегистрируйтесь на https://www.assemblyai.com/dashboard/signup (Google или почта).',
    'Ключ уже создан: откройте https://www.assemblyai.com/dashboard/api-keys и нажмите «Copy».',
    'Вставьте ключ ниже.',
  ],
  keyPlaceholder: 'ключ AssemblyAI (32 символа)',
  maxBytes: 2000 * 1024 ** 2,
  cors: 'unknown',
  tags: ['ru-en', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'language',
      label: 'Язык',
      default: 'mix',
      options: [
        { value: 'mix', label: 'RU + EN (code-switching)' },
        { value: 'auto', label: 'Авто (определить один язык)' },
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      kind: 'select',
      id: 'models',
      label: 'Модель',
      default: 'universal-2',
      options: [
        { value: 'universal-2', label: 'Universal-2 — поддерживает русский' },
        { value: 'universal-3-5-pro,universal-2', label: 'Universal-3.5 Pro → откат на Universal-2' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', default: true },
    { kind: 'number', id: 'speakers', label: 'Сколько спикеров', hint: '0 — автоматически.', default: 0, min: 0, max: 10 },
    { kind: 'toggle', id: 'disfluencies', label: 'Оставлять «э-э», «мм»', default: false },
  ],
  async transcribe(file, _name, ctx) {
    const s = ctx.settings
    const auth = { Authorization: ctx.apiKey }
    ctx.onStatus('Загружаю файл…')
    const { data: up } = await requestJson<{ upload_url: string }>(ctx, `${BASE}/upload`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/octet-stream' },
      body: file,
    })
    const lang = String(s.language || 'mix')
    const body: Record<string, unknown> = {
      audio_url: up.upload_url,
      speech_models: String(s.models || 'universal-2').split(','),
      punctuate: true,
      format_text: true,
      disfluencies: !!s.disfluencies,
      speaker_labels: !!s.diarize,
    }
    if (s.diarize && Number(s.speakers) > 0) body.speakers_expected = Number(s.speakers)
    if (lang === 'mix') {
      body.language_detection = true
      body.language_detection_options = { expected_languages: ['ru', 'en'], code_switching: true }
    } else if (lang === 'auto') body.language_detection = true
    else body.language_code = lang

    const { data: created } = await requestJson<Transcript>(ctx, `${BASE}/transcript`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const t = await poll<Transcript>(ctx, async () => {
      const { data } = await requestJson<Transcript>(ctx, `${BASE}/transcript/${created.id}`, { headers: auth })
      if (data.status === 'error') throw new Error(`AssemblyAI: ${data.error}`)
      return { done: data.status === 'completed', value: data, status: data.status }
    })
    const segments = t.utterances?.length
      ? t.utterances.map((u) => ({ start: u.start / 1000, end: u.end / 1000, text: u.text, speaker: speakerName(u.speaker) }))
      : wordsToSegments((t.words ?? []).map((w) => ({ text: w.text, start: w.start / 1000, end: w.end / 1000 })))
    return {
      text: s.diarize && segments.length ? segmentsToText(segments) : (t.text ?? '').trim(),
      segments,
      language: t.language_code,
      duration: t.audio_duration,
      raw: t,
    }
  },
  async checkLimits(ctx) {
    const { data } = await requestJson<{ transcripts?: { created: string; audio_duration?: number | null }[] }>(
      ctx,
      `${BASE}/transcript?limit=200`,
      { headers: { Authorization: ctx.apiKey } },
    )
    const month = new Date()
    month.setDate(1)
    month.setHours(0, 0, 0, 0)
    const list = (data.transcripts ?? []).filter((t) => new Date(t.created) >= month)
    return {
      items: [
        { label: 'Ключ', value: 'работает ✓' },
        { label: 'Расшифровок в этом месяце', value: String(list.length) },
      ],
      note: 'Баланс кредитов AssemblyAI показывает только в кабинете: assemblyai.com/dashboard → Billing.',
    }
  },
}
