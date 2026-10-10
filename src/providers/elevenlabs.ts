import { langOrUndefined, pickRateHeaders, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'
import { locale, t, tf, tx } from '@/lib/i18n'
import { L_DIARIZE, L_LANGUAGE, L_MODEL, L_SPEAKERS } from './langs'

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
  tagline: t(
    'Одна из самых точных моделей: 90+ языков, сильный казахский, спикеры и пословные таймкоды.',
    'One of the most accurate models: 90+ languages, strong Kazakh, speakers and word-level timestamps.',
  ),
  description: t(
    'Scribe v2 от ElevenLabs по независимым бенчмаркам — в верхней группе по точности. Сам определяет язык и нормально держит переключения RU↔EN внутри разговора, хорошо знает казахский (по данным ElevenLabs, WER ≈3% на FLEURS). Умеет разделять до 32 спикеров, помечать смех и шумы, принимает список ключевых терминов. Бесплатный план — 10 000 кредитов в месяц, карта не нужна. Сервис недоступен из России.',
    'ElevenLabs Scribe v2 ranks among the most accurate models in independent benchmarks. It detects the language itself, copes with RU↔EN switching within a conversation and knows Kazakh well (≈3% WER on FLEURS, according to ElevenLabs). It separates up to 32 speakers, tags laughter and noises, and accepts a list of key terms. The free plan gives 10,000 credits a month, no card required. Not available from Russia.',
  ),
  langs: { ru: 3, en: 3, kk: 3, mix: 3 },
  free: t('10 000 кредитов в месяц', '10,000 credits per month'),
  limits: [
    t(
      'Free: 10 000 кредитов в месяц, обновляются ежемесячно (сколько это часов распознавания — видно в кабинете → Subscription)',
      'Free: 10,000 credits per month, renewed monthly (how many hours of transcription that buys is shown in your account → Subscription)',
    ),
    t('Файл до 3 ГБ / 10 часов за запрос', 'Up to 3 GB / 10 hours per request'),
    t('Ключевые термины (keyterms) увеличивают стоимость на 20%', 'Key terms (keyterms) add 20% to the cost'),
    t('Недоступен из РФ', 'Not available from Russia'),
  ],
  pricing: t('Scribe ≈ $0,22–0,40 за час в зависимости от плана', 'Scribe ≈ $0.22–0.40 per hour depending on the plan'),
  card: 'no',
  keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
  signupUrl: 'https://elevenlabs.io/app/sign-up',
  docsUrl: 'https://elevenlabs.io/docs/capabilities/speech-to-text',
  keySteps: [
    t('Зарегистрируйтесь на https://elevenlabs.io/app/sign-up (Google или почта).', 'Sign up at https://elevenlabs.io/app/sign-up (Google or email).'),
    t('Откройте https://elevenlabs.io/app/settings/api-keys → «Create API Key».', 'Open https://elevenlabs.io/app/settings/api-keys → “Create API Key”.'),
    t(
      'В правах ключа оставьте доступ к Speech to Text и User (чтобы видеть баланс), нажмите Create.',
      'In the key permissions keep access to Speech to Text and User (to see your balance), then click Create.',
    ),
    t('Скопируйте ключ (sk_…) и вставьте ниже.', 'Copy the key (sk_…) and paste it below.'),
  ],
  keyPlaceholder: 'sk_…',
  maxBytes: 1024 ** 3,
  cors: 'yes',
  tags: ['ru-en', 'kk', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: L_MODEL,
      default: 'scribe_v2',
      options: [
        { value: 'scribe_v2', label: t('scribe_v2 — новая, точнее', 'scribe_v2 — newer, more accurate') },
        { value: 'scribe_v1', label: t('scribe_v1 — предыдущая', 'scribe_v1 — previous') },
      ],
    },
    {
      kind: 'select',
      id: 'language',
      label: L_LANGUAGE,
      hint: t('Для смешанной речи — «Авто».', 'For mixed speech use “Auto-detect”.'),
      default: 'auto',
      options: [
        { value: 'auto', label: t('Авто (определить)', 'Auto-detect') },
        { value: 'rus', label: 'Русский' },
        { value: 'eng', label: 'English' },
        { value: 'kaz', label: 'Қазақша' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    {
      kind: 'number',
      id: 'speakers',
      label: L_SPEAKERS,
      hint: t('0 — определить автоматически.', '0 — detect automatically.'),
      default: 0,
      min: 0,
      max: 32,
    },
    {
      kind: 'toggle',
      id: 'events',
      label: t('Помечать звуки', 'Tag sounds'),
      hint: t('(смех), (музыка), (аплодисменты)', '(laughter), (music), (applause)'),
      default: false,
    },
    {
      kind: 'text',
      id: 'keyterms',
      label: t('Ключевые термины', 'Key terms'),
      hint: t('Через запятую: имена, бренды, жаргон. +20% к стоимости.', 'Comma-separated: names, brands, jargon. +20% to the cost.'),
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

    ctx.onStatus(tx(t('Распознаю…', 'Transcribing…')))
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
        { label: tx(t('Тариф', 'Plan')), value: `${data.tier ?? '—'}${data.status ? ` (${data.status})` : ''}` },
        {
          label: tx(t('Кредиты', 'Credits')),
          value: tf(t('{used} из {limit} — осталось {left}', '{used} of {limit} — {left} left'), {
            used: used.toLocaleString(locale()),
            limit: limit.toLocaleString(locale()),
            left: (limit - used).toLocaleString(locale()),
          }),
          progress: limit ? used / limit : undefined,
        },
        ...(data.next_character_count_reset_unix
          ? [{ label: tx(t('Обновление', 'Resets on')), value: new Date(data.next_character_count_reset_unix * 1000).toLocaleDateString(locale()) }]
          : []),
      ],
      note: tx(
        t(
          'Если видите 401 — у ключа нет права «User: read». Распознавать он при этом может.',
          'A 401 here means the key lacks the “User: read” permission. It can still transcribe.',
        ),
      ),
    }
  },
}
