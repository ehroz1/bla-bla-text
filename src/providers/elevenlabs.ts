import { langOrUndefined, pickRateHeaders, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'

const BASE = 'https://api.elevenlabs.io/v1'

interface ScribeResponse {
  language_code?: string
  language_probability?: number
  text: string
  words?: { text: string; start: number; end: number; type: 'word' | 'spacing' | 'audio_event'; speaker_id?: string }[]
  audio_duration_secs?: number
}

export const elevenlabs: Provider = {
  id: 'elevenlabs',
  name: 'ElevenLabs Scribe',
  vendor: 'ElevenLabs',
  tagline: 'Одна из самых точных моделей: 90+ языков, сильный казахский, спикеры и пословные таймкоды.',
  description:
    'Scribe v2 от ElevenLabs по независимым бенчмаркам — в верхней группе по точности. Сам определяет язык и нормально держит переключения RU↔EN внутри разговора, хорошо знает казахский (по данным ElevenLabs, WER ≈3% на FLEURS). Умеет разделять до 32 спикеров, помечать смех и шумы, принимает список ключевых терминов. Бесплатный план — 10 000 кредитов в месяц, карта не нужна. Сервис недоступен из России.',
  langs: { ru: 3, en: 3, kk: 3, mix: 3 },
  free: '10 000 кредитов в месяц',
  limits: [
    'Free: 10 000 кредитов в месяц, обновляются ежемесячно (сколько это часов распознавания — видно в кабинете → Subscription)',
    'Файл до 3 ГБ / 10 часов за запрос',
    'Ключевые термины (keyterms) увеличивают стоимость на 20%',
    'Недоступен из РФ',
  ],
  pricing: 'Scribe ≈ $0,22–0,40 за час в зависимости от плана',
  card: 'не нужна',
  keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
  signupUrl: 'https://elevenlabs.io/app/sign-up',
  docsUrl: 'https://elevenlabs.io/docs/capabilities/speech-to-text',
  keySteps: [
    'Зарегистрируйтесь на https://elevenlabs.io/app/sign-up (Google или почта).',
    'Откройте https://elevenlabs.io/app/settings/api-keys → «Create API Key».',
    'В правах ключа оставьте доступ к Speech to Text и User (чтобы видеть баланс), нажмите Create.',
    'Скопируйте ключ (sk_…) и вставьте ниже.',
  ],
  keyPlaceholder: 'sk_…',
  maxBytes: 1024 ** 3,
  cors: 'yes',
  tags: ['ru-en', 'kk', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: 'Модель',
      default: 'scribe_v2',
      options: [
        { value: 'scribe_v2', label: 'scribe_v2 — новая, точнее' },
        { value: 'scribe_v1', label: 'scribe_v1 — предыдущая' },
      ],
    },
    {
      kind: 'select',
      id: 'language',
      label: 'Язык',
      hint: 'Для смешанной речи — «Авто».',
      default: 'auto',
      options: [
        { value: 'auto', label: 'Авто (определить)' },
        { value: 'rus', label: 'Русский' },
        { value: 'eng', label: 'English' },
        { value: 'kaz', label: 'Қазақша' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: 'Разделять спикеров', default: true },
    { kind: 'number', id: 'speakers', label: 'Сколько спикеров', hint: '0 — определить автоматически.', default: 0, min: 0, max: 32 },
    { kind: 'toggle', id: 'events', label: 'Помечать звуки', hint: '(смех), (музыка), (аплодисменты)', default: false },
    {
      kind: 'text',
      id: 'keyterms',
      label: 'Ключевые термины',
      hint: 'Через запятую: имена, бренды, жаргон. +20% к стоимости.',
      default: '',
      placeholder: 'Kubernetes, Айгерим, Kaspi, sprint review',
    },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const form = new FormData()
    form.append('file', file, fileName)
    form.append('model_id', String(s.model || 'scribe_v2'))
    const lang = langOrUndefined(s.language)
    if (lang) form.append('language_code', lang)
    form.append('diarize', String(!!s.diarize))
    if (s.diarize && Number(s.speakers) > 0) form.append('num_speakers', String(s.speakers))
    form.append('tag_audio_events', String(!!s.events))
    form.append('timestamps_granularity', 'word')
    String(s.keyterms || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => form.append('keyterms', t))

    ctx.onStatus('Распознаю…')
    const { data, res } = await requestJson<ScribeResponse>(ctx, `${BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': ctx.apiKey },
      body: form,
    })
    const words = (data.words ?? [])
      .filter((w) => w.type !== 'audio_event' || s.events)
      .map((w) => ({
        text: w.type === 'audio_event' ? ` ${w.text}` : w.text,
        start: w.start,
        end: w.end,
        speaker: s.diarize ? speakerName(w.speaker_id) : undefined,
      }))
    const segments = wordsToSegments(words, { spaced: true })
    return {
      text: s.diarize && segments.length ? segmentsToText(segments) : data.text.trim(),
      segments,
      language: data.language_code,
      duration: data.audio_duration_secs,
      rateLimit: pickRateHeaders(res),
      raw: data,
    }
  },
  async checkLimits(ctx) {
    const { data } = await requestJson<{
      tier?: string
      character_count?: number
      character_limit?: number
      next_character_count_reset_unix?: number
      status?: string
    }>(ctx, `${BASE}/user/subscription`, { headers: { 'xi-api-key': ctx.apiKey } })
    const used = data.character_count ?? 0
    const limit = data.character_limit ?? 0
    return {
      items: [
        { label: 'Тариф', value: `${data.tier ?? '—'}${data.status ? ` (${data.status})` : ''}` },
        {
          label: 'Кредиты',
          value: `${used.toLocaleString('ru-RU')} из ${limit.toLocaleString('ru-RU')} — осталось ${(limit - used).toLocaleString('ru-RU')}`,
          progress: limit ? used / limit : undefined,
        },
        ...(data.next_character_count_reset_unix
          ? [{ label: 'Обновление', value: new Date(data.next_character_count_reset_unix * 1000).toLocaleDateString('ru-RU') }]
          : []),
      ],
      note: 'Если видите 401 — у ключа нет права «User: read». Распознавать он при этом может.',
    }
  },
}
