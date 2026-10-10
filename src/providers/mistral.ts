import { langOrUndefined, pickRateHeaders, requestJson } from './http'
import { segmentsToText, speakerName } from './segments'
import type { Provider } from './types'
import { t, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK, L_LANGUAGE } from './langs'

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
  vendor: t('Mistral AI (Франция)', 'Mistral AI (France)'),
  tagline: t(
    'Voxtral Transcribe 2: дёшево, спикеры, подсказки-термины. Бесплатный режим без карты.',
    'Voxtral Transcribe 2: cheap, speakers, term hints. Free plan with no card.',
  ),
  description: t(
    'Voxtral — модель распознавания от французской Mistral AI. Поддерживает 13 языков, включая русский и английский (казахского нет), различает спикеров и принимает список терминов (context bias), чтобы правильно писать имена и жаргон. В бесплатном режиме Free можно пользоваться без карты — нужна только верификация по телефону.',
    'Voxtral is a speech recognition model from the French company Mistral AI. It supports 13 languages including Russian and English (no Kazakh), separates speakers and accepts a list of terms (context bias) to spell names and jargon correctly. The Free plan works without a card — only phone verification is needed.',
  ),
  langs: { ru: 2, en: 3, kk: 0, mix: 2 },
  free: t('Бесплатный режим Free', 'Free plan'),
  limits: [
    t('Free: без карты, нужна верификация телефона; лимиты запросов — admin.mistral.ai → Limits', 'Free: no card, phone verification required; request limits at admin.mistral.ai → Limits'),
    t('На Free данные могут использоваться для обучения (можно отключить в настройках)', 'On Free your data may be used for training (can be turned off in settings)'),
    t('До ~3 часов аудио за запрос', 'Up to ~3 hours of audio per request'),
    t(
      'Нельзя одновременно задать язык и получить таймкоды — выбирайте «Авто» для таймкодов',
      'You cannot set a language and get timestamps at the same time — choose “Auto” for timestamps',
    ),
  ],
  pricing: t('$0,003/мин ≈ $0,18/ч', '$0.003/min ≈ $0.18/h'),
  card: 'no',
  keyUrl: 'https://console.mistral.ai/api-keys',
  signupUrl: 'https://console.mistral.ai/',
  docsUrl: 'https://docs.mistral.ai/capabilities/audio_transcription',
  keySteps: [
    t('Войдите на https://console.mistral.ai (Google, Microsoft или почта).', 'Sign in at https://console.mistral.ai (Google, Microsoft or email).'),
    t('Создайте организацию и выберите план «Experiment / Free», подтвердите номер телефона.', 'Create an organization, choose the “Experiment / Free” plan and verify your phone number.'),
    t('Откройте https://console.mistral.ai/api-keys → «Create new key», скопируйте ключ и вставьте ниже.', 'Open https://console.mistral.ai/api-keys → “Create new key”, copy the key and paste it below.'),
  ],
  keyPlaceholder: 'Mistral API key',
  maxBytes: 200 * 1024 ** 2,
  maxChunkSeconds: 3 * 3600 - 300,
  cors: 'unknown',
  tags: ['ru-en', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'language',
      label: L_LANGUAGE,
      hint: t('С явным языком сервис не отдаёт таймкоды.', 'With an explicit language the service returns no timestamps.'),
      default: 'auto',
      options: [
        { value: 'auto', label: t('Авто (с таймкодами)', 'Auto (with timestamps)') },
        { value: 'ru', label: t('Русский (без таймкодов)', 'Russian (no timestamps)') },
        { value: 'en', label: t('English (без таймкодов)', 'English (no timestamps)') },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    {
      kind: 'text',
      id: 'context',
      label: t('Термины (context bias)', 'Terms (context bias)'),
      hint: t('Через запятую, до 100 слов.', 'Comma-separated, up to 100 words.'),
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
    ctx.onStatus(tx(t('Распознаю…', 'Transcribing…')))
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
        { label: tx(L_KEY), value: tx(L_KEY_OK) },
        { label: tx(t('Voxtral-модели', 'Voxtral models')), value: [...new Set(voxtral)].slice(0, 5).join(', ') || '—' },
        ...Object.entries(headers).map(([label, value]) => ({ label, value })),
      ],
      note: tx(t('Лимиты бесплатного режима: admin.mistral.ai/plateforme/limits', 'Free plan limits: admin.mistral.ai/plateforme/limits')),
    }
  },
}
