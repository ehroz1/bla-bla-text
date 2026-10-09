import { pickRateHeaders, requestJson } from './http'
import { segmentsToText } from './segments'
import type { Provider, ProviderContext, Segment, TranscriptResult } from './types'

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
  if (s.diarize) lines.push('Identify different speakers and label them consistently as "Спикер 1", "Спикер 2", etc.')
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
  ctx.onStatus('Кодирую аудио…')
  const data = await blobToBase64(file)
  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: SCHEMA,
    maxOutputTokens: 65536,
  }
  // Для расшифровки «размышления» не нужны: быстрее и не тратят лимит токенов.
  if (/^gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }

  ctx.onStatus(`Распознаю (${model})…`)
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

  if (out.promptFeedback?.blockReason) throw new Error(`Gemini отказался обрабатывать файл: ${out.promptFeedback.blockReason}`)
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
      throw new Error('Ответ Gemini обрезан по лимиту токенов — уменьшите длину куска или выберите другую модель.')
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
  tagline: 'Мультимодальная LLM: лучше всех держит смешанную RU+EN речь, понимает казахский, размечает спикеров.',
  description:
    'Gemini — не классический распознаватель, а большая языковая модель, которая «слушает» аудио. Поэтому она отлично справляется с речью вперемешку (русский с английскими терминами, казахский с русским), сама ставит пунктуацию и может разделить спикеров. Минусы: таймкоды приблизительные, на длинных файлах изредка пропускает фрагменты — поэтому BLA-БЛА отправляет запись кусками по 10 минут. Бесплатный ключ — в Google AI Studio за минуту, карта не нужна.',
  langs: { ru: 3, en: 3, kk: 2, mix: 3 },
  free: 'Бесплатно: лимит запросов в день',
  limits: [
    'Бесплатный уровень: лимиты на запросы в минуту и в день зависят от модели (актуальные — в AI Studio → Usage & limits)',
    'На бесплатном уровне Google может использовать данные для улучшения моделей — не отправляйте конфиденциальное',
    'Запрос до 20 МБ: BLA-БЛА режет запись на куски по 10 минут',
    'В некоторых странах AI Studio недоступен без VPN',
  ],
  pricing: 'Платный уровень: Flash ≈ $0,07–0,12 за час аудио',
  card: 'не нужна',
  keyUrl: 'https://aistudio.google.com/app/apikey',
  signupUrl: 'https://aistudio.google.com/',
  docsUrl: 'https://ai.google.dev/gemini-api/docs/audio',
  keySteps: [
    'Откройте https://aistudio.google.com/app/apikey и войдите Google-аккаунтом.',
    'Примите условия, нажмите «Create API key» (проект создастся автоматически).',
    'Скопируйте ключ (начинается с AIza) и вставьте ниже.',
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
      label: 'Модель',
      hint: 'Если модель недоступна для вашего ключа — нажмите «Проверить ключ», там список доступных.',
      default: 'gemini-flash-latest',
      options: [
        { value: 'gemini-flash-latest', label: 'Flash (последняя) — рекомендуется' },
        { value: 'gemini-flash-lite-latest', label: 'Flash-Lite (последняя) — быстрее, больше бесплатных запросов' },
        { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash — стабильная' },
        { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite' },
        { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro — точнее (на бесплатном уровне может быть недоступна)' },
      ],
    },
    {
      kind: 'select',
      id: 'language',
      label: 'Язык записи',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Авто (RU / EN / KZ вперемешку)' },
        { value: 'ru-en', label: 'Русский + английские вставки' },
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
        { value: 'kk', label: 'Қазақша (+ русский)' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', hint: '«Спикер 1», «Спикер 2»…', default: true },
    { kind: 'toggle', id: 'filler', label: 'Оставлять слова-паразиты', hint: '«э-э», «ну», «um»', default: false },
    {
      kind: 'text',
      id: 'prompt',
      label: 'Контекст и глоссарий',
      hint: 'Тема, имена, термины — модель напишет их правильно.',
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
        { label: 'Ключ', value: 'работает ✓' },
        { label: 'Доступно моделей Gemini', value: String(names.length) },
        { label: 'Flash-модели', value: names.filter((n) => n.includes('flash') && !/tts|image|live|audio/.test(n)).slice(0, 8).join(', ') || '—' },
      ],
      note: 'Остаток бесплатных запросов Google показывает только в AI Studio → Usage & limits (по API его не узнать).',
    }
  },
}
