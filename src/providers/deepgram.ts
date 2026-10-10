import { langOrUndefined, pickRateHeaders, requestJson } from './http'
import { segmentsToText, speakerName, wordsToSegments } from './segments'
import type { Provider } from './types'
import { t, tf, tx } from '@/lib/i18n'
import { L_DIARIZE, L_KEY, L_KEY_OK, L_LANGUAGE } from './langs'

const BASE = 'https://api.deepgram.com/v1'

interface DgResponse {
  metadata?: { duration?: number }
  results?: {
    channels?: {
      detected_language?: string
      alternatives?: {
        transcript: string
        languages?: string[]
        words?: { word: string; punctuated_word?: string; start: number; end: number; speaker?: number }[]
      }[]
    }[]
    utterances?: { start: number; end: number; transcript: string; speaker?: number }[]
  }
}

export const deepgram: Provider = {
  id: 'deepgram',
  name: 'Deepgram Nova-3',
  vendor: 'Deepgram',
  tagline: t(
    'Nova-3 Multilingual: настоящий code-switching RU↔EN, очень быстро. $200 на старте, но нужен прокси.',
    'Nova-3 Multilingual: real RU↔EN code-switching, very fast. $200 to start, but needs a proxy.',
  ),
  description: t(
    'Deepgram Nova-3 в режиме multi распознаёт речь, где языки меняются прямо в предложении (русский входит в список). Очень быстрый, с пословными таймкодами, спикерами и ключевыми терминами (keyterm). $200 бесплатных кредитов без карты — это сотни часов. Минус для браузера: REST API Deepgram не разрешает CORS, поэтому нужен свой бесплатный прокси (Cloudflare Worker, инструкция во вкладке «Настройки»). Казахского нет.',
    'Deepgram Nova-3 in multi mode transcribes speech where languages change mid-sentence (Russian is on the list). Very fast, with word-level timestamps, speakers and key terms (keyterm). $200 of free credits with no card — hundreds of hours. The browser downside: Deepgram’s REST API does not allow CORS, so you need your own free proxy (a Cloudflare Worker, instructions in Settings). No Kazakh.',
  ),
  langs: { ru: 3, en: 3, kk: 0, mix: 3 },
  free: t('$200 при регистрации', '$200 on sign-up'),
  limits: [
    t('Free: разовые $200 кредитов, без карты (≈ 650+ часов Nova-3)', 'Free: one-time $200 of credits, no card (≈ 650+ hours of Nova-3)'),
    t('Файл до 2 ГБ', 'Files up to 2 GB'),
    t('Из браузера — только через свой CORS-прокси', 'From the browser only through your own CORS proxy'),
  ],
  pricing: t('Nova-3 ≈ $0,26/ч, multilingual ≈ $0,31/ч', 'Nova-3 ≈ $0.26/h, multilingual ≈ $0.31/h'),
  card: 'no',
  keyUrl: 'https://console.deepgram.com/project/_/keys',
  signupUrl: 'https://console.deepgram.com/signup',
  docsUrl: 'https://developers.deepgram.com/docs/pre-recorded-audio',
  keySteps: [
    t('Зарегистрируйтесь на https://console.deepgram.com/signup (Google, GitHub или почта).', 'Sign up at https://console.deepgram.com/signup (Google, GitHub or email).'),
    t(
      'В проекте откройте «API Keys» → «Create a New API Key», роль Member или выше (для просмотра баланса).',
      'In your project open “API Keys” → “Create a New API Key” with the Member role or higher (to see the balance).',
    ),
    t('Скопируйте ключ и вставьте ниже.', 'Copy the key and paste it below.'),
    t('Разверните CORS-прокси (вкладка «Настройки») и включите его для Deepgram.', 'Deploy the CORS proxy (Settings tab) and enable it for Deepgram.'),
  ],
  keyPlaceholder: 'Deepgram API key (40 chars)',
  maxBytes: 1500 * 1024 ** 2,
  cors: 'no',
  tags: ['ru-en', 'free', 'fast', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'language',
      label: L_LANGUAGE,
      default: 'multi',
      options: [
        { value: 'multi', label: t('Multilingual — RU+EN вперемешку', 'Multilingual — mixed RU+EN') },
        { value: 'ru', label: 'Русский' },
        { value: 'en', label: 'English' },
      ],
    },
    { kind: 'toggle', id: 'diarize', label: L_DIARIZE, default: true },
    { kind: 'toggle', id: 'filler', label: t('Оставлять «э-э», «um»', 'Keep “uh”, “um”'), default: false },
    {
      kind: 'text',
      id: 'keyterms',
      label: t('Ключевые термины (keyterm)', 'Key terms (keyterm)'),
      hint: t('Через запятую.', 'Comma-separated.'),
      default: '',
      placeholder: 'Kubernetes, Айгерим, deadline',
    },
  ],
  async transcribe(file, _name, ctx) {
    const s = ctx.settings
    const q = new URLSearchParams({ model: 'nova-3', smart_format: 'true', punctuate: 'true', paragraphs: 'true' })
    q.set('language', langOrUndefined(s.language) ?? 'multi')
    if (s.diarize) {
      q.set('diarize', 'true')
      q.set('utterances', 'true')
    }
    if (s.filler) q.set('filler_words', 'true')
    String(s.keyterms || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => q.append('keyterm', t))
    ctx.onStatus(tx(t('Распознаю…', 'Transcribing…')))
    const { data, res } = await requestJson<DgResponse>(ctx, `${BASE}/listen?${q}`, {
      method: 'POST',
      headers: { Authorization: `Token ${ctx.apiKey}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    const ch = data.results?.channels?.[0]
    const alt = ch?.alternatives?.[0]
    const segments = data.results?.utterances?.length
      ? data.results.utterances.map((u) => ({ start: u.start, end: u.end, text: u.transcript, speaker: s.diarize ? speakerName(u.speaker) : undefined }))
      : wordsToSegments((alt?.words ?? []).map((w) => ({ text: w.punctuated_word ?? w.word, start: w.start, end: w.end })))
    return {
      text: s.diarize && segments.some((x) => x.speaker) ? segmentsToText(segments) : (alt?.transcript ?? '').trim(),
      segments,
      language: alt?.languages?.join(', ') || ch?.detected_language,
      duration: data.metadata?.duration,
      rateLimit: pickRateHeaders(res),
      raw: data,
    }
  },
  async checkLimits(ctx) {
    const auth = { Authorization: `Token ${ctx.apiKey}` }
    const { data } = await requestJson<{ projects?: { project_id: string; name: string }[] }>(ctx, `${BASE}/projects`, { headers: auth })
    const items: { label: string; value: string }[] = [{ label: tx(L_KEY), value: tx(L_KEY_OK) }]
    for (const p of data.projects ?? []) {
      try {
        const { data: b } = await requestJson<{ balances?: { amount: number; units: string }[] }>(
          ctx,
          `${BASE}/projects/${p.project_id}/balances`,
          { headers: auth },
        )
        for (const bal of b.balances ?? []) items.push({ label: tf(t('Баланс «{p}»', 'Balance “{p}”'), { p: p.name }), value: `${bal.amount.toFixed(2)} ${bal.units}` })
      } catch {
        items.push({
          label: tf(t('Проект «{p}»', 'Project “{p}”'), { p: p.name }),
          value: tx(t('баланс скрыт (нужна роль Member+)', 'balance hidden (Member+ role required)')),
        })
      }
    }
    return { items }
  },
}
