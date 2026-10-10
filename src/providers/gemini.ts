import { pickRateHeaders, requestJson } from './http'
import { segmentsToText } from './segments'
import type { Provider, ProviderContext, Segment, TranscriptResult } from './types'
import { t, tf, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK, L_MODEL } from './langs'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',', 2)[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** "01:02:03.5" | "02:03" | "123.4" -> секунды */
export function parseClock(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return 0
  const parts = v.trim().split(':').map((p) => parseFloat(p.replace(',', '.')))
  if (parts.some((n) => Number.isNaN(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

const LANG_HINT: Record<string, string> = {
  auto: 'The audio may contain Russian, English and Kazakh, often mixed within one sentence.',
  'ru-en': 'The speech is Russian mixed with English words and phrases (code-switching).',
  ru: 'The speech is in Russian.',
  en: 'The speech is in English.',
  kk: 'The speech is in Kazakh, possibly mixed with Russian.',
}

function buildPrompt(s: ProviderContext['settings']): string {
  const lang = LANG_HINT[String(s.language)] ?? LANG_HINT.auto
  const lines = [
    'Transcribe this audio verbatim.',
    lang,
    'Write every word exactly in the language and script it was spoken in: Russian and Kazakh in Cyrillic, English words in Latin letters. Never translate. Do not summarize or skip anything.',
    'Use proper punctuation and capitalization.',
  ]
  if (s.diarize) {
    const w = tx(t('Спикер', 'Speaker'))
    lines.push(`Identify different speakers and label them consistently as "${w} 1", "${w} 2", etc.`)
  }
  else lines.push('Use an empty string for speaker.')
  lines.push('Split the transcript into segments of one or two sentences with start and end timestamps in MM:SS format relative to the beginning of this audio.')
  if (s.filler === false) lines.push('Omit filler words like "э-э", "ну", "um", "uh".')
  if (s.prompt) lines.push(`Context / glossary (spell these terms exactly): ${s.prompt}`)
  return lines.join('\n')
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    language: { type: 'STRING' },
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'STRING' },
          end: { type: 'STRING' },
          speaker: { type: 'STRING' },
          text: { type: 'STRING' },
        },
        required: ['start', 'end', 'text'],
      },
    },
  },
  required: ['segments'],
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: Record<string, number>
}

async function transcribe(file: Blob, _name: string, ctx: ProviderContext): Promise<TranscriptResult> {
  const model = String(ctx.settings.model || 'gemini-flash-latest')
  ctx.onStatus(tx(t('Кодирую аудио…', 'Encoding audio…')))
  const data = await blobToBase64(file)
  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    maxOutputTokens: 65536,
  }
  // Для расшифровки «размышления» не нужны: быстрее и не тратят лимит токенов.
  if (/^gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }

  ctx.onStatus(tf(t('Распознаю ({model})…', 'Transcribing ({model})…'), { model }))
  const { data: out, res } = await requestJson<GenerateResponse>(ctx, `${BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ctx.apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: file.type || 'audio/mpeg', data } }, { text: buildPrompt(ctx.settings) }],
        },
      ],
      generationConfig,
    }),
  })

  if (out.promptFeedback?.blockReason) throw new Error(tf(t('Gemini отказался обрабатывать файл: {r}', 'Gemini refused to process the file: {r}'), { r: out.promptFeedback.blockReason }))
  const cand = out.candidates?.[0]
  const raw = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
  let parsed: { language?: string; segments?: { start: unknown; end: unknown; speaker?: string; text: string }[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    if (cand?.finishReason === 'MAX_TOKENS')
      throw new Error(
        tx(
          t(
            'Ответ Gemini обрезан по лимиту токенов — уменьшите длину куска или выберите другую модель.',
            'The Gemini response was cut off by the token limit — use shorter chunks or another model.',
          ),
        ),
      )
    // Модель вернула не-JSON: отдаём как обычный текст.
    return { text: raw.trim(), rateLimit: pickRateHeaders(res), raw: out }
  }
  const segments: Segment[] = (parsed.segments ?? [])
    .filter((s) => s.text?.trim())
    .map((s) => ({
      start: parseClock(s.start),
      end: parseClock(s.end),
      text: s.text.trim(),
      speaker: s.speaker?.trim() || undefined,
    }))
  const text = segmentsToText(segments)
  return { text, segments, language: parsed.language, rateLimit: pickRateHeaders(res), raw: out }
}

export const gemini: Provider = {
  id: 'gemini',
  name: 'Google Gemini',
  vendor: 'Google AI Studio',
  tagline: t(
    'Мультимодальная LLM: лучше всех держит смешанную RU+EN речь, понимает казахский, размечает спикеров.',
    'A multimodal LLM: handles mixed RU+EN speech best, understands Kazakh, labels speakers.',
  ),
  description: t(
    'Gemini — не классический распознаватель, а большая языковая модель, которая «слушает» аудио. Поэтому она отлично справляется с речью вперемешку (русский с английскими терминами, казахский с русским), сама ставит пунктуацию и может разделить спикеров. Минусы: таймкоды приблизительные, на длинных файлах изредка пропускает фрагменты — поэтому BLA-БЛА отправляет запись кусками по 10 минут. Бесплатный ключ — в Google AI Studio за минуту, карта не нужна.',
    'Gemini is not a classic speech recognizer but a large language model that “listens” to audio. That makes it great with mixed speech (Russian with English terms, Kazakh with Russian); it adds punctuation itself and can separate speakers. Downsides: timestamps are approximate and it occasionally skips fragments of long files — so BLA-БЛА sends recordings in 10-minute chunks. A free key from Google AI Studio takes a minute, no card required.',
  ),
  langs: { ru: 3, en: 3, kk: 2, mix: 3 },
  free: t('Бесплатно: лимит запросов в день', 'Free: daily request quota'),
  limits: [
    t(
      'Бесплатный уровень: лимиты на запросы в минуту и в день зависят от модели (актуальные — в AI Studio → Usage & limits)',
      'Free tier: per-minute and per-day request limits depend on the model (current values in AI Studio → Usage & limits)',
    ),
    t(
      'На бесплатном уровне Google может использовать данные для улучшения моделей — не отправляйте конфиденциальное',
      'On the free tier Google may use your data to improve its models — do not upload confidential recordings',
    ),
    t('Запрос до 20 МБ: BLA-БЛА режет запись на куски по 10 минут', 'Requests up to 20 MB: BLA-БЛА splits recordings into 10-minute chunks'),
    t('В некоторых странах AI Studio недоступен без VPN', 'AI Studio is unavailable in some countries without a VPN'),
  ],
  pricing: t('Платный уровень: Flash ≈ $0,07–0,12 за час аудио', 'Paid tier: Flash ≈ $0.07–0.12 per hour of audio'),
  card: 'no',
  keyUrl: 'https://aistudio.google.com/app/apikey',
  signupUrl: 'https://aistudio.google.com/',
  docsUrl: 'https://ai.google.dev/gemini-api/docs/audio',
  keySteps: [
    t('Откройте https://aistudio.google.com/app/apikey и войдите Google-аккаунтом.', 'Open https://aistudio.google.com/app/apikey and sign in with your Google account.'),
    t('Примите условия, нажмите «Create API key» (проект создастся автоматически).', 'Accept the terms and click “Create API key” (a project is created automatically).'),
    t('Скопируйте ключ (начинается с AIza) и вставьте ниже.', 'Copy the key (starts with AIza) and paste it below.'),
  ],
  keyPlaceholder: 'AIza…',
  maxBytes: 14 * 1024 ** 2,
  maxChunkSeconds: 600,
  cors: 'yes',
  tags: ['ru-en', 'kk', 'free', 'diarization', 'timestamps', 'llm'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: L_MODEL,
      hint: t(
        'Если модель недоступна для вашего ключа — нажмите «Проверить ключ», там список доступных.',
        'If a model is not available for your key, click “Check key” to see the available ones.',
      ),
      default: 'gemini-flash-latest',
      options: [
        { value: 'gemini-flash-latest', label: t('Flash (последняя) — рекомендуется', 'Flash (latest) — recommended') },
        { value: 'gemini-flash-lite-latest', label: t('Flash-Lite (последняя) — быстрее, больше бесплатных запросов', 'Flash-Lite (latest) — faster, more free requests') },
        { value: 'gemini-2.5-flash', label: t('gemini-2.5-flash — стабильная', 'gemini-2.5-flash — stable') },
        { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
        { value: 'gemini-2.5-pro', label: t('gemini-2.5-pro — точнее (на бесплатном уровне может быть недоступна)', 'gemini-2.5-pro — more accurate (may be unavailable on the free tier)') },
      ],
    },
    {
      kind: 'select',
      id: 'language',
      label: t('Язык записи', 'Recording language'),
      default: 'auto',
      options: [
        { value: 'auto', label: t('Авто (RU / EN / KZ вперемешку)', 'Auto (mixed RU / EN / KZ)') },
        { value: 'ru-en', label: t('Русский + английские вставки', 'Russian with English phrases') },
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
        { value: 'kk', label: t('Қазақша (+ русский)', 'Қазақша (+ Russian)') },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, hint: t('«Спикер 1», «Спикер 2»…', '“Speaker 1”, “Speaker 2”…'), default: true },
    { kind: 'toggle', id: 'filler', label: t('Оставлять слова-паразиты', 'Keep filler words'), hint: t('«э-э», «ну», «um»', '“uh”, “um”, «э-э»'), default: false },
    {
      kind: 'text',
      id: 'prompt',
      label: t('Контекст и глоссарий', 'Context and glossary'),
      hint: t('Тема, имена, термины — модель напишет их правильно.', 'Topic, names, terms — the model will spell them correctly.'),
      default: '',
      placeholder: 'Созвон команды разработки. Имена: Айгерим, Дмитрий. Термины: Kubernetes, sprint review.',
      multiline: true,
    },
  ],
  transcribe,
  async checkLimits(ctx) {
    const { data } = await requestJson<{ models?: { name: string }[] }>(ctx, `${BASE}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': ctx.apiKey },
    })
    const names = (data.models ?? []).map((m) => m.name.replace('models/', '')).filter((n) => n.startsWith('gemini'))
    return {
      items: [
        { label: tx(L_KEY), value: tx(L_KEY_OK) },
        { label: tx(t('Доступно моделей Gemini', 'Gemini models available')), value: String(names.length) },
        { label: tx(t('Flash-модели', 'Flash models')), value: names.filter((n) => n.includes('flash') && !/tts|image|live|audio/.test(n)).slice(0, 8).join(', ') || '—' },
      ],
      note: tx(
        t(
          'Остаток бесплатных запросов Google показывает только в AI Studio → Usage & limits (по API его не узнать).',
          'Google shows the remaining free quota only in AI Studio → Usage & limits (it is not available via the API).',
        ),
      ),
    }
  },
}
