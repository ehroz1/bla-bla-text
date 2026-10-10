import { poll, requestJson } from './http'
import { segmentsToText, speakerName } from './segments'
import type { Provider } from './types'
import { t, tf, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK } from './langs'

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
  vendor: t('Gladia (Франция)', 'Gladia (France)'),
  tagline: t(
    'Явный code-switching для RU+EN и KZ+RU: каждая фраза помечается своим языком. €50 на старте.',
    'Explicit code-switching for RU+EN and KZ+RU: each phrase is tagged with its language. €50 to start.',
  ),
  description: t(
    'Gladia — французский API на базе доработанного Whisper (модель Solaria-1, 100+ языков, включая казахский). Главная фишка — режим code-switching: вы указываете языки разговора (например, ru+en или kk+ru), и сервис определяет язык каждой фразы. Спикеры, словарь терминов. Бесплатно — разовые €50 кредитов.',
    'Gladia is a French API built on an improved Whisper (the Solaria-1 model, 100+ languages including Kazakh). Its highlight is code-switching: you list the conversation languages (e.g. ru+en or kk+ru) and the service detects the language of each phrase. Speakers, custom vocabulary. Free: one-time €50 of credits.',
  ),
  langs: { ru: 2, en: 3, kk: 2, mix: 3 },
  free: t('€50 при регистрации', '€50 on sign-up'),
  limits: [
    t('Free: разовые €50 кредитов', 'Free: one-time €50 of credits'),
    t('До 3 одновременных задач', 'Up to 3 concurrent jobs'),
    t('Файл до 1 ГБ и до 135 минут (длиннее — режем на части)', 'Files up to 1 GB and 135 minutes (longer files are split)'),
  ],
  pricing: t('Starter ≈ $0,61/ч', 'Starter ≈ $0.61/h'),
  card: 'no',
  keyUrl: 'https://app.gladia.io/apikeys',
  signupUrl: 'https://app.gladia.io/auth/signup',
  docsUrl: 'https://docs.gladia.io/chapters/pre-recorded-stt/getting-started',
  keySteps: [
    t('Зарегистрируйтесь на https://app.gladia.io (проще всего через Google).', 'Sign up at https://app.gladia.io (Google is the quickest).'),
    t(
      'Откройте https://app.gladia.io/apikeys — ключ по умолчанию уже есть, или нажмите «Generate new API key».',
      'Open https://app.gladia.io/apikeys — a default key already exists, or click “Generate new API key”.',
    ),
    t('Скопируйте ключ и вставьте ниже.', 'Copy the key and paste it below.'),
  ],
  keyPlaceholder: 'Gladia API key (UUID)',
  maxBytes: 1000 * 1024 ** 2,
  maxChunkSeconds: 130 * 60,
  cors: 'unknown',
  tags: ['ru-en', 'kk', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'languages',
      label: t('Языки разговора', 'Conversation languages'),
      default: 'ru-en',
      options: [
        { value: 'ru-en', label: t('Русский + английский', 'Russian + English') },
        { value: 'kk-ru', label: t('Казахский + русский', 'Kazakh + Russian') },
        { value: 'kk-ru-en', label: t('Казахский + русский + английский', 'Kazakh + Russian + English') },
        { value: 'ru', label: t('Только русский', 'Russian only') },
        { value: 'en', label: t('Только английский', 'English only') },
        { value: 'kk', label: t('Только казахский', 'Kazakh only') },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    {
      kind: 'text',
      id: 'vocabulary',
      label: t('Словарь терминов', 'Custom vocabulary'),
      hint: t('Через запятую — имена, бренды, жаргон.', 'Comma-separated: names, brands, jargon.'),
      default: '',
      placeholder: 'Kaspi, Айгерим, deploy, Jira',
    },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const auth = { 'x-gladia-key': ctx.apiKey }
    ctx.onStatus(tx(t('Загружаю файл…', 'Uploading the file…')))
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
      if (data.status === 'error')
        throw new Error(tf(t('Gladia вернула ошибку (код {c})', 'Gladia returned an error (code {c})'), { c: data.error_code ?? '—' }))
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
        { label: tx(L_KEY), value: tx(L_KEY_OK) },
        ...(data.total != null ? [{ label: tx(t('Всего расшифровок', 'Total transcripts')), value: String(data.total) }] : []),
      ],
      note: tx(t('Остаток кредитов — в кабинете app.gladia.io → Billing.', 'Remaining credits: app.gladia.io → Billing.')),
    }
  },
}
