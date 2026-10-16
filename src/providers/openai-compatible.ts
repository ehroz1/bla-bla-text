// Общая реализация для API, совместимых с OpenAI /v1/audio/transcriptions (OpenAI, Groq…).
import { langOrUndefined, pickRateHeaders, requestJson } from './http'
import type { ProviderContext, Segment, TranscriptResult } from './types'
import { t, tx } from '@/lib/i18n'

interface VerboseJson {
  text: string
  language?: string
  duration?: number
  segments?: { start: number; end: number; text: string; speaker?: string }[]
}

export async function openaiTranscribe(
  baseUrl: string,
  file: Blob,
  fileName: string,
  ctx: ProviderContext,
  opts: {
    model: string
    language?: string
    prompt?: string
    temperature?: number
    /** verbose_json даёт таймкоды; новые gpt-4o-* модели понимают только json/text. */
    responseFormat: 'verbose_json' | 'json' | 'diarized_json'
    extra?: Record<string, string>
  },
): Promise<TranscriptResult> {
  const form = new FormData()
  form.append('file', file, fileName)
  form.append('model', opts.model)
  form.append('response_format', opts.responseFormat)
  const lang = langOrUndefined(opts.language)
  if (lang) form.append('language', lang)
  if (opts.prompt) form.append('prompt', opts.prompt)
  if (opts.temperature != null) form.append('temperature', String(opts.temperature))
  if (opts.responseFormat === 'verbose_json') form.append('timestamp_granularities[]', 'segment')
  for (const [k, v] of Object.entries(opts.extra ?? {})) form.append(k, v)

  ctx.onStatus(tx(t('Распознаю…', 'Transcribing…')))
  const { data, res } = await requestJson<VerboseJson>(ctx, `${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.apiKey}` },
    body: form,
  })
  const segments: Segment[] | undefined = data.segments?.map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    speaker: s.speaker,
  }))
  const text =
    opts.responseFormat === 'diarized_json' && segments?.length
      ? segments.map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text)).join('\n')
      : data.text?.trim() ?? ''
  return { text, segments, language: data.language, duration: data.duration, rateLimit: pickRateHeaders(res), raw: data }
}

/** Проверка ключа через GET /models + заголовки лимитов. */
export async function openaiCheckKey(baseUrl: string, ctx: Pick<ProviderContext, 'apiKey' | 'fetch' | 'signal'>) {
  const { data, res } = await requestJson<{ data?: { id: string }[] }>(ctx, `${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${ctx.apiKey}` },
  })
  return { models: (data.data ?? []).map((m) => m.id), headers: pickRateHeaders(res) }
}
