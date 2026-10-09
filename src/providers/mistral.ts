import { langOrUndefined, pickRateHeaders, requestJson } from './http'
import { segmentsToText, speakerName } from './segments'
import type { Provider } from './types'

const BASE = 'https://api.mistral.ai/v1'

interface VoxtralResponse {
  text: string
  language?: string | null
  segments?: { text: string; start: number; end: number; speaker_id?: string | number | null }[]
  usage?: { prompt_audio_seconds?: number }
}

export const mistral: Provider = {
  id: 'mistral',
  name: 'Mistral Voxtral',
  vendor: 'Mistral AI (Франция)',
  tagline: 'Voxtral Transcribe 2: дёшево, спикеры, подсказки-термины. Бесплатный режим без карты.',
  description:
    'Voxtral — модель распознавания от французской Mistral AI. Поддерживает 13 языков, включая русский и английский (казахского нет), различает спикеров и принимает список терминов (context bias), чтобы правильно писать имена и жаргон. В бесплатном режиме Free можно пользоваться без карты — нужна только верификация по телефону.',
  langs: { ru: 2, en: 3, kk: 0, mix: 2 },
  free: 'Бесплатный режим Free',
  limits: [
    'Free: без карты, нужна верификация телефона; лимиты запросов — admin.mistral.ai → Limits',
    'На Free данные могут использоваться для обучения (можно отключить в настройках)',
    'До ~3 часов аудио за запрос',
    'Нельзя одновременно задать язык и получить таймкоды — выбирайте «Авто» для таймкодов',
  ],
  pricing: '$0,003/мин ≈ $0,18/ч',
  card: 'не нужна',
  keyUrl: 'https://console.mistral.ai/api-keys',
  signupUrl: 'https://console.mistral.ai/',
  docsUrl: 'https://docs.mistral.ai/capabilities/audio_transcription',
  keySteps: [
    'Войдите на https://console.mistral.ai (Google, Microsoft или почта).',
    'Создайте организацию и выберите план «Experiment / Free», подтвердите номер телефона.',
    'Откройте https://console.mistral.ai/api-keys → «Create new key», скопируйте ключ и вставьте ниже.',
  ],
  keyPlaceholder: 'ключ Mistral',
  maxBytes: 200 * 1024 ** 2,
  maxChunkSeconds: 3 * 3600 - 300,
  cors: 'unknown',
  tags: ['ru-en', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'language',
      label: 'Язык',
      hint: 'С явным языком сервис не отдаёт таймкоды.',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Авто (с таймкодами)' },
        { value: 'ru', label: 'Русский (без таймкодов)' },
        { value: 'en', label: 'English (без таймкодов)' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', default: true },
    {
      kind: 'text',
      id: 'context',
      label: 'Термины (context bias)',
      hint: 'Через запятую, до 100 слов.',
      default: '',
      placeholder: 'Kubernetes, Айгерим, deadline',
    },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const form = new FormData()
    form.append('file', file, fileName)
    form.append('model', 'voxtral-mini-latest')
    const lang = langOrUndefined(s.language)
    if (lang) form.append('language', lang)
    else form.append('timestamp_granularities', 'segment')
    if (s.diarize) form.append('diarize', 'true')
    String(s.context || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 100)
      .forEach((t) => form.append('context_bias', t))
    ctx.onStatus('Распознаю…')
    const { data, res } = await requestJson<VoxtralResponse>(ctx, `${BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      body: form,
    })
    const segments = (data.segments ?? []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      speaker: s.diarize ? speakerName(seg.speaker_id) : undefined,
    }))
    return {
      text: s.diarize && segments.some((x) => x.speaker) ? segmentsToText(segments) : data.text.trim(),
      segments,
      language: data.language ?? undefined,
      duration: data.usage?.prompt_audio_seconds,
      rateLimit: pickRateHeaders(res),
      raw: data,
    }
  },
  async checkLimits(ctx) {
    const { data, res } = await requestJson<{ data?: { id: string }[] }>(ctx, `${BASE}/models`, {
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
    })
    const voxtral = (data.data ?? []).map((m) => m.id).filter((id) => id.includes('voxtral'))
    const headers = pickRateHeaders(res) ?? {}
    return {
      items: [
        { label: 'Ключ', value: 'работает ✓' },
        { label: 'Voxtral-модели', value: [...new Set(voxtral)].slice(0, 5).join(', ') || '—' },
        ...Object.entries(headers).map(([label, value]) => ({ label, value })),
      ],
      note: 'Лимиты бесплатного режима: admin.mistral.ai/plateforme/limits',
    }
  },
}
