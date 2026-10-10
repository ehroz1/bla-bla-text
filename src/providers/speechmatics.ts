import { poll, requestJson } from './http'
import { segmentsToText, speakerName } from './segments'
import type { Provider, Segment } from './types'
import { t, tf, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK, L_THIS_MONTH } from './langs'

const REGIONS: Record<string, string> = {
  eu: 'https://eu1.asr.api.speechmatics.com/v2',
  us: 'https://us1.asr.api.speechmatics.com/v2',
}

interface JsonV2 {
  metadata?: { transcription_config?: { language?: string } }
  results: {
    type: 'word' | 'punctuation' | 'speaker_change'
    start_time: number
    end_time: number
    is_eos?: boolean
    attaches_to?: 'previous' | 'next' | 'none' | 'both'
    alternatives?: { content: string; language?: string; speaker?: string }[]
  }[]
}

function toSegments(data: JsonV2, diarize: boolean): Segment[] {
  const out: Segment[] = []
  let cur: Segment | null = null
  for (const r of data.results ?? []) {
    const alt = r.alternatives?.[0]
    if (!alt) continue
    const speaker = diarize ? speakerName(alt.speaker, 1) : undefined
    if (r.type === 'word') {
      if (cur && cur.speaker !== speaker) {
        out.push(cur)
        cur = null
      }
      if (!cur) cur = { start: r.start_time, end: r.end_time, text: alt.content, speaker }
      else cur.text += ' ' + alt.content
      cur.end = r.end_time
    } else if (r.type === 'punctuation' && cur) {
      cur.text += r.attaches_to === 'next' ? ' ' + alt.content : alt.content
      if (r.is_eos) {
        out.push(cur)
        cur = null
      }
    }
  }
  if (cur) out.push(cur)
  return out
}

export const speechmatics: Provider = {
  id: 'speechmatics',
  name: 'Speechmatics',
  vendor: t('Speechmatics (Великобритания)', 'Speechmatics (UK)'),
  tagline: t(
    'Отдельная модель для речи вперемешку: Melia-1 сама переключается между RU и EN посреди фразы.',
    'A dedicated model for mixed speech: Melia-1 switches between RU and EN mid-sentence.',
  ),
  description: t(
    'Speechmatics — британский enterprise-распознаватель. Модель Melia-1 сделана именно для мультиязычных записей: язык может меняться посреди разговора, каждое слово помечается своим языком. Для чисто русских или английских записей есть классические Standard/Enhanced. Казахского нет. $100 бесплатных кредитов при регистрации, карта не нужна.',
    'Speechmatics is a British enterprise speech recognizer. Its Melia-1 model is built for multilingual recordings: the language can change mid-conversation and each word is tagged with its language. For purely Russian or English recordings there are the classic Standard/Enhanced models. No Kazakh. $100 of free credits on sign-up, no card required.',
  ),
  langs: { ru: 3, en: 3, kk: 0, mix: 3 },
  free: t('$100 при регистрации', '$100 on sign-up'),
  limits: [
    t('Free: разовые $100 кредитов (≈ 250–750 часов в зависимости от модели), без карты', 'Free: one-time $100 of credits (≈ 250–750 hours depending on the model), no card'),
    t('Файл до 1 ГБ, до 2 часов на Free', 'Files up to 1 GB, up to 2 hours on Free'),
    t('Melia-1: только регионы EU/US, без словаря и confidence', 'Melia-1: EU/US regions only, no custom dictionary or confidence scores'),
  ],
  pricing: t('Melia-1 ≈ $0,13/ч, Standard ≈ $0,24/ч, Enhanced ≈ $0,40/ч', 'Melia-1 ≈ $0.13/h, Standard ≈ $0.24/h, Enhanced ≈ $0.40/h'),
  card: 'no',
  keyUrl: 'https://portal.speechmatics.com/settings/api-keys',
  signupUrl: 'https://portal.speechmatics.com/signup',
  docsUrl: 'https://docs.speechmatics.com/speech-to-text/batch/quickstart',
  keySteps: [
    t('Зарегистрируйтесь на https://portal.speechmatics.com/signup (почта или Google).', 'Sign up at https://portal.speechmatics.com/signup (email or Google).'),
    t('Откройте Settings → API Keys: https://portal.speechmatics.com/settings/api-keys', 'Open Settings → API Keys: https://portal.speechmatics.com/settings/api-keys'),
    t('Нажмите «Create API Key», скопируйте ключ и вставьте ниже.', 'Click “Create API Key”, copy the key and paste it below.'),
  ],
  keyPlaceholder: 'Speechmatics API key',
  maxBytes: 1000 * 1024 ** 2,
  maxChunkSeconds: 2 * 3600,
  cors: 'unknown',
  tags: ['ru-en', 'free', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'mode',
      label: t('Модель и язык', 'Model and language'),
      default: 'melia',
      options: [
        { value: 'melia', label: t('Melia-1 — RU + EN вперемешку (рекомендуется)', 'Melia-1 — mixed RU + EN (recommended)') },
        { value: 'ru-enhanced', label: t('Enhanced — только русский, максимум точности', 'Enhanced — Russian only, maximum accuracy') },
        { value: 'en-enhanced', label: t('Enhanced — только английский', 'Enhanced — English only') },
        { value: 'ru-standard', label: t('Standard — русский, дешевле', 'Standard — Russian, cheaper') },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    {
      kind: 'select',
      id: 'region',
      label: t('Регион', 'Region'),
      default: 'eu',
      options: [
        { value: 'eu', label: t('Европа (eu1)', 'Europe (eu1)') },
        { value: 'us', label: t('США (us1)', 'USA (us1)') },
      ],
    },
  ],
  async transcribe(file, fileName, ctx) {
    const s = ctx.settings
    const base = REGIONS[String(s.region)] ?? REGIONS.eu
    const mode = String(s.mode || 'melia')
    const tc: Record<string, unknown> =
      mode === 'melia'
        ? { model: 'melia-1', language: 'multi', language_hints: ['ru', 'en'] }
        : { language: mode.slice(0, 2), operating_point: mode.endsWith('enhanced') ? 'enhanced' : 'standard', enable_entities: true }
    if (s.diarize) tc.diarization = 'speaker'
    const form = new FormData()
    form.append('data_file', file, fileName)
    form.append('config', JSON.stringify({ type: 'transcription', transcription_config: tc }))
    const auth = { Authorization: `Bearer ${ctx.apiKey}` }

    ctx.onStatus(tx(t('Загружаю файл…', 'Uploading the file…')))
    const { data: job } = await requestJson<{ id: string }>(ctx, `${base}/jobs/`, { method: 'POST', headers: auth, body: form })
    await poll(ctx, async () => {
      const { data } = await requestJson<{ job: { status: string; errors?: { message: string }[] } }>(ctx, `${base}/jobs/${job.id}`, {
        headers: auth,
      })
      const st = data.job.status
      if (st === 'rejected' || st === 'deleted' || st === 'expired')
        throw new Error(
          tf(t('Speechmatics отклонил задачу: {r}', 'Speechmatics rejected the job: {r}'), {
            r: data.job.errors?.map((e) => e.message).join('; ') || st,
          }),
        )
      return { done: st === 'done', status: st }
    })
    const { data } = await requestJson<JsonV2>(ctx, `${base}/jobs/${job.id}/transcript?format=json-v2`, { headers: auth })
    const segments = toSegments(data, !!s.diarize)
    return { text: segmentsToText(segments), segments, language: data.metadata?.transcription_config?.language, raw: data }
  },
  async checkLimits(ctx) {
    const since = new Date()
    since.setDate(1)
    const { data } = await requestJson<{ summary?: { mode: string; type: string; count: number; duration_hrs: number; operating_point?: string }[] }>(
      ctx,
      `${REGIONS.eu}/usage?since=${since.toISOString().slice(0, 10)}`,
      { headers: { Authorization: `Bearer ${ctx.apiKey}` } },
    )
    const rows = (data.summary ?? []).filter((r) => r.count > 0)
    return {
      items: [
        { label: tx(L_KEY), value: tx(L_KEY_OK) },
        ...(rows.length
          ? rows.map((r) => ({
              label: `${tx(L_THIS_MONTH)}: ${r.type} ${r.mode}${r.operating_point ? ' ' + r.operating_point : ''}`,
              value: tf(t('{h} ч · {n} задач', '{h} h · {n} jobs'), { h: r.duration_hrs.toFixed(2), n: r.count }),
            }))
          : [{ label: tx(L_THIS_MONTH), value: tx(t('0 ч', '0 h')) }]),
      ],
      note: tx(t('Остаток кредитов — в портале: portal.speechmatics.com → Usage/Billing.', 'Remaining credits: portal.speechmatics.com → Usage/Billing.')),
    }
  },
}
