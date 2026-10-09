import { poll, request, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'

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
  tagline: 'Лидер по казахскому и смешанной речи (KZ/RU/EN в одном предложении). Самый дешёвый: $0,10/ч.',
  description:
    'Soniox — одна модель на 60+ языков, которая сама переключается между ними посреди фразы и помечает язык каждого слова. По бенчмаркам Soniox — один из лучших результатов на казахском и на русско-английской смеси. Бесплатные кредиты для новых аккаунтов отменены (октябрь 2025), но цена очень низкая: $0,10 за час — пополнения на $5 хватит на ~50 часов.',
  langs: { ru: 3, en: 3, kk: 3, mix: 3 },
  free: 'Платно: $0,10/ч',
  limits: ['Бесплатных кредитов для новых регистраций нет — нужно пополнение', 'Файл до 1 ГБ / 5 часов', 'Возможно, понадобится CORS-прокси'],
  pricing: '$0,10 за час (асинхронно)',
  card: 'нужна',
  keyUrl: 'https://console.soniox.com/',
  signupUrl: 'https://console.soniox.com/signup',
  docsUrl: 'https://soniox.com/docs/stt/async/async-transcription',
  keySteps: [
    'Зарегистрируйтесь на https://console.soniox.com/signup',
    'Пополните баланс в разделе Billing.',
    'В проекте откройте «API Keys» → «Create API key», скопируйте и вставьте ниже.',
  ],
  keyPlaceholder: 'ключ Soniox',
  maxBytes: 1000 * 1024 ** 2,
  maxChunkSeconds: 5 * 3600 - 300,
  cors: 'unknown',
  tags: ['ru-en', 'kk', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'hints',
      label: 'Языки в записи',
      default: 'kk-ru-en',
      options: [
        { value: 'kk-ru-en', label: 'Казахский + русский + английский' },
        { value: 'ru-en', label: 'Русский + английский' },
        { value: 'kk-ru', label: 'Казахский + русский' },
        { value: 'kk', label: 'Казахский' },
        { value: 'ru', label: 'Русский' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', default: true },
    {
      kind: 'text',
      id: 'context',
      label: 'Контекст и термины',
      hint: 'Тема разговора и слова, которые важно написать правильно.',
      default: '',
      placeholder: 'Совещание в Astana Hub. Термины: Kaspi, onboarding, Айгерим.',
    },
    { kind: 'text', id: 'model', label: 'Модель', hint: 'Обычно менять не нужно.', default: 'stt-async-v5' },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const auth = { Authorization: `Bearer ${ctx.apiKey}` }
    ctx.onStatus('Загружаю файл…')
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
    const { data: t } = await requestJson<{ id: string }>(ctx, `${BASE}/transcriptions`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    try {
      await poll(ctx, async () => {
        const { data } = await requestJson<{ status: string; error_message?: string }>(ctx, `${BASE}/transcriptions/${t.id}`, { headers: auth })
        if (data.status === 'error') throw new Error(`Soniox: ${data.error_message ?? 'ошибка'}`)
        return { done: data.status === 'completed', status: data.status }
      })
      const { data } = await requestJson<{
        text: string
        tokens?: { text: string; start_ms: number; end_ms: number; speaker?: string; language?: string }[]
      }>(ctx, `${BASE}/transcriptions/${t.id}/transcript`, { headers: auth })
      const tokens = data.tokens ?? []
      const segments = wordsToSegments(
        tokens.map((tk) => ({ text: tk.text, start: tk.start_ms / 1000, end: tk.end_ms / 1000, speaker: s.diarize ? speakerName(tk.speaker, 1) : undefined })),
        { spaced: true, maxWords: 60 },
      )
      const langs = [...new Set(tokens.map((tk) => tk.language).filter(Boolean))]
      return { text: s.diarize ? segmentsToText(segments) : data.text.trim(), segments, language: langs.join(', '), raw: data }
    } finally {
      // Не храним файлы на стороне сервиса дольше нужного.
      void request(ctx, `${BASE}/transcriptions/${t.id}`, { method: 'DELETE', headers: auth }).catch(() => {})
      void request(ctx, `${BASE}/files/${f.id}`, { method: 'DELETE', headers: auth }).catch(() => {})
    }
  },
  async checkLimits(ctx) {
    await requestJson(ctx, `${BASE}/files?limit=1`, { headers: { Authorization: `Bearer ${ctx.apiKey}` } })
    return { items: [{ label: 'Ключ', value: 'работает ✓' }], note: 'Баланс — console.soniox.com → Billing.' }
  },
}
