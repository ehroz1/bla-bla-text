import { poll, request, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'
import { t, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK, L_MODEL } from './langs'

const BASE = 'https://api.soniox.com/v1'

const HINTS: Record<string, string[]> = {
  'kk-ru-en': ['kk', 'ru', 'en'],
  'ru-en': ['ru', 'en'],
  'kk-ru': ['kk', 'ru'],
  kk: ['kk'],
  ru: ['ru'],
}

export const soniox: Provider = {
  id: 'soniox',
  name: 'Soniox',
  vendor: 'Soniox',
  tagline: t(
    'Лидер по казахскому и смешанной речи (KZ/RU/EN в одном предложении). Самый дешёвый: $0,10/ч.',
    'A leader for Kazakh and mixed speech (KZ/RU/EN in one sentence). The cheapest: $0.10/h.',
  ),
  description: t(
    'Soniox — одна модель на 60+ языков, которая сама переключается между ними посреди фразы и помечает язык каждого слова. По бенчмаркам Soniox — один из лучших результатов на казахском и на русско-английской смеси. Бесплатные кредиты для новых аккаунтов отменены (октябрь 2025), но цена очень низкая: $0,10 за час — пополнения на $5 хватит на ~50 часов.',
    'Soniox is a single model for 60+ languages that switches between them mid-phrase and tags the language of every word. In Soniox’s own benchmarks it has some of the best results on Kazakh and on Russian–English mix. Free credits for new accounts were discontinued (October 2025), but the price is very low: $0.10 per hour — a $5 top-up covers ~50 hours.',
  ),
  langs: { ru: 3, en: 3, kk: 3, mix: 3 },
  free: t('Платно: $0,10/ч', 'Paid: $0.10/h'),
  limits: [
    t('Бесплатных кредитов для новых регистраций нет — нужно пополнение', 'No free credits for new sign-ups — a top-up is required'),
    t('Файл до 1 ГБ / 5 часов', 'Files up to 1 GB / 5 hours'),
    t('Возможно, понадобится CORS-прокси', 'A CORS proxy may be needed'),
  ],
  pricing: t('$0,10 за час (асинхронно)', '$0.10 per hour (async)'),
  card: 'yes',
  keyUrl: 'https://console.soniox.com/',
  signupUrl: 'https://console.soniox.com/signup',
  docsUrl: 'https://soniox.com/docs/stt/async/async-transcription',
  keySteps: [
    t('Зарегистрируйтесь на https://console.soniox.com/signup', 'Sign up at https://console.soniox.com/signup'),
    t('Пополните баланс в разделе Billing.', 'Top up your balance in Billing.'),
    t('В проекте откройте «API Keys» → «Create API key», скопируйте и вставьте ниже.', 'In your project open “API Keys” → “Create API key”, copy it and paste it below.'),
  ],
  keyPlaceholder: 'Soniox API key',
  maxBytes: 1000 * 1024 ** 2,
  maxChunkSeconds: 5 * 3600 - 300,
  cors: 'unknown',
  tags: ['ru-en', 'kk', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'hints',
      label: t('Языки в записи', 'Languages in the recording'),
      default: 'kk-ru-en',
      options: [
        { value: 'kk-ru-en', label: t('Казахский + русский + английский', 'Kazakh + Russian + English') },
        { value: 'ru-en', label: t('Русский + английский', 'Russian + English') },
        { value: 'kk-ru', label: t('Казахский + русский', 'Kazakh + Russian') },
        { value: 'kk', label: t('Казахский', 'Kazakh') },
        { value: 'ru', label: t('Русский', 'Russian') },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    {
      kind: 'text',
      id: 'context',
      label: t('Контекст и термины', 'Context and terms'),
      hint: t('Тема разговора и слова, которые важно написать правильно.', 'The topic and words that must be spelled correctly.'),
      default: '',
      placeholder: 'Совещание в Astana Hub. Термины: Kaspi, onboarding, Айгерим.',
    },
    { kind: 'text', id: 'model', label: L_MODEL, hint: t('Обычно менять не нужно.', 'Usually no need to change.'), default: 'stt-async-v5' },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const auth = { Authorization: `Bearer ${ctx.apiKey}` }
    ctx.onStatus(tx(t('Загружаю файл…', 'Uploading the file…')))
    const form = new FormData()
    form.append('file', file, fileName)
    const { data: f } = await requestJson<{ id: string }>(ctx, `${BASE}/files`, { method: 'POST', headers: auth, body: form })
    const body: Record<string, unknown> = {
      model: String(s.model || 'stt-async-v5'),
      file_id: f.id,
      language_hints: HINTS[String(s.hints)] ?? HINTS['kk-ru-en'],
      enable_language_identification: true,
      enable_speaker_diarization: !!s.diarize,
    }
    if (s.context) body.context = { text: String(s.context) }
    const { data: job } = await requestJson<{ id: string }>(ctx, `${BASE}/transcriptions`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    try {
      await poll(ctx, async () => {
        const { data } = await requestJson<{ status: string; error_message?: string }>(ctx, `${BASE}/transcriptions/${job.id}`, { headers: auth })
        if (data.status === 'error') throw new Error(`Soniox: ${data.error_message ?? tx(t('ошибка', 'error'))}`)
        return { done: data.status === 'completed', status: data.status }
      })
      const { data } = await requestJson<{
        text: string
        tokens?: { text: string; start_ms: number; end_ms: number; speaker?: string; language?: string }[]
      }>(ctx, `${BASE}/transcriptions/${job.id}/transcript`, { headers: auth })
      const tokens = data.tokens ?? []
      const segments = wordsToSegments(
        tokens.map((tk) => ({ text: tk.text, start: tk.start_ms / 1000, end: tk.end_ms / 1000, speaker: s.diarize ? speakerName(tk.speaker, 1) : undefined })),
        { spaced: true, maxWords: 60 },
      )
      const langs = [...new Set(tokens.map((tk) => tk.language).filter(Boolean))]
      return { text: s.diarize ? segmentsToText(segments) : data.text.trim(), segments, language: langs.join(', '), raw: data }
    } finally {
      // Не храним файлы на стороне сервиса дольше нужного.
      void request(ctx, `${BASE}/transcriptions/${job.id}`, { method: 'DELETE', headers: auth }).catch(() => {})
      void request(ctx, `${BASE}/files/${f.id}`, { method: 'DELETE', headers: auth }).catch(() => {})
    }
  },
  async checkLimits(ctx) {
    await requestJson(ctx, `${BASE}/files?limit=1`, { headers: { Authorization: `Bearer ${ctx.apiKey}` } })
    return { items: [{ label: tx(L_KEY), value: tx(L_KEY_OK) }], note: tx(t('Баланс — console.soniox.com → Billing.', 'Balance: console.soniox.com → Billing.')) }
  },
}
