import { poll, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'
import { t, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK, L_LANGUAGE, L_MODEL, L_SPEAKERS } from './langs'

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
  tagline: t(
    'Universal: 99 языков, режим code-switching для RU+EN, спикеры, ключевые слова. $50 на старте.',
    'Universal: 99 languages, a code-switching mode for RU+EN, speakers, key words. $50 to start.',
  ),
  description: t(
    'AssemblyAI — популярный американский API распознавания. Для русского используется модель Universal-2 (флагман Universal-3 Pro русский пока не поддерживает — включён режим «с откатом»). Есть явный режим code-switching: сервис определяет, где RU, а где EN. Спикеры, пунктуация, форматирование чисел. $50 бесплатных кредитов (≈ 300+ часов), без карты.',
    'AssemblyAI is a popular US speech-to-text API. Russian uses the Universal-2 model (the flagship Universal-3 Pro does not support Russian yet, so a fallback mode is available). There is an explicit code-switching mode: the service detects where RU and EN are spoken. Speakers, punctuation, number formatting. $50 of free credits (≈ 300+ hours), no card.',
  ),
  langs: { ru: 2, en: 3, kk: 0, mix: 2 },
  free: t('$50 при регистрации', '$50 on sign-up'),
  limits: [
    t('Free: разовые $50 кредитов, без карты', 'Free: one-time $50 of credits, no card'),
    t('До 5 одновременных задач на бесплатном аккаунте', 'Up to 5 concurrent jobs on a free account'),
    t('Файл до 2,2 ГБ / 10 часов', 'Files up to 2.2 GB / 10 hours'),
  ],
  pricing: t('Universal-2 ≈ $0,15/ч, дополнения (спикеры и т.п.) — отдельно', 'Universal-2 ≈ $0.15/h, add-ons (speakers etc.) billed separately'),
  card: 'no',
  keyUrl: 'https://www.assemblyai.com/dashboard/api-keys',
  signupUrl: 'https://www.assemblyai.com/dashboard/signup',
  docsUrl: 'https://www.assemblyai.com/docs/getting-started/transcribe-an-audio-file',
  keySteps: [
    t('Зарегистрируйтесь на https://www.assemblyai.com/dashboard/signup (Google или почта).', 'Sign up at https://www.assemblyai.com/dashboard/signup (Google or email).'),
    t('Ключ уже создан: откройте https://www.assemblyai.com/dashboard/api-keys и нажмите «Copy».', 'A key already exists: open https://www.assemblyai.com/dashboard/api-keys and click “Copy”.'),
    t('Вставьте ключ ниже.', 'Paste the key below.'),
  ],
  keyPlaceholder: 'AssemblyAI API key (32 chars)',
  maxBytes: 2000 * 1024 ** 2,
  cors: 'unknown',
  tags: ['ru-en', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'language',
      label: L_LANGUAGE,
      default: 'mix',
      options: [
        { value: 'mix', label: 'RU + EN (code-switching)' },
        { value: 'auto', label: t('Авто (определить один язык)', 'Auto (detect a single language)') },
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      kind: 'select',
      id: 'models',
      label: L_MODEL,
      default: 'universal-2',
      options: [
        { value: 'universal-2', label: t('Universal-2 — поддерживает русский', 'Universal-2 — supports Russian') },
        { value: 'universal-3-5-pro,universal-2', label: t('Universal-3.5 Pro → откат на Universal-2', 'Universal-3.5 Pro → fallback to Universal-2') },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    {
      kind: 'number',
      id: 'speakers',
      label: L_SPEAKERS,
      hint: t('0 — автоматически.', '0 — automatic.'),
      default: 0,
      min: 0,
      max: 10,
    },
    { kind: 'toggle', id: 'disfluencies', label: t('Оставлять «э-э», «мм»', 'Keep “uh”, “um”'), default: false },
  ],
  async transcribe(file, _name, ctx) {
    const s = ctx.settings
    const auth = { Authorization: ctx.apiKey }
    ctx.onStatus(tx(t('Загружаю файл…', 'Uploading the file…')))
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
    const job = await poll<Transcript>(ctx, async () => {
      const { data } = await requestJson<Transcript>(ctx, `${BASE}/transcript/${created.id}`, { headers: auth })
      if (data.status === 'error') throw new Error(`AssemblyAI: ${data.error}`)
      return { done: data.status === 'completed', value: data, status: data.status }
    })
    const segments = job.utterances?.length
      ? job.utterances.map((u) => ({ start: u.start / 1000, end: u.end / 1000, text: u.text, speaker: speakerName(u.speaker) }))
      : wordsToSegments((job.words ?? []).map((w) => ({ text: w.text, start: w.start / 1000, end: w.end / 1000 })))
    return {
      text: s.diarize && segments.length ? segmentsToText(segments) : (job.text ?? '').trim(),
      segments,
      language: job.language_code,
      duration: job.audio_duration,
      raw: job,
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
        { label: tx(L_KEY), value: tx(L_KEY_OK) },
        { label: tx(t('Расшифровок в этом месяце', 'Transcripts this month')), value: String(list.length) },
      ],
      note: tx(
        t(
          'Баланс кредитов AssemblyAI показывает только в кабинете: assemblyai.com/dashboard → Billing.',
          'AssemblyAI shows the credit balance only in the dashboard: assemblyai.com/dashboard → Billing.',
        ),
      ),
    }
  },
}
