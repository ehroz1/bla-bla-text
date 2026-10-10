import { openaiCheckKey, openaiTranscribe } from './openai-compatible'
import { L_KEY, L_KEY_OK, L_LANGUAGE, L_MODEL, LANG_OPTIONS_WHISPER } from './langs'
import { speakerName } from './segments'
import type { Provider } from './types'
import { t, tx } from '@/lib/i18n'

const BASE = 'https://api.openai.com/v1'

export const openai: Provider = {
  id: 'openai',
  name: 'OpenAI',
  vendor: 'OpenAI',
  tagline: t(
    'gpt-4o-transcribe и Whisper — эталон качества. Платно: бесплатного лимита нет.',
    'gpt-4o-transcribe and Whisper — a quality benchmark. Paid: no free tier.',
  ),
  description: t(
    'Оригинальные модели OpenAI. gpt-4o-transcribe заметно точнее Whisper на смешанной речи и шумных записях, gpt-4o-transcribe-diarize размечает спикеров, whisper-1 даёт таймкоды. Бесплатного тарифа нет: нужно пополнить баланс от $5. Добавлен для сравнения и тем, у кого ключ уже есть.',
    'The original OpenAI models. gpt-4o-transcribe is noticeably more accurate than Whisper on mixed speech and noisy recordings, gpt-4o-transcribe-diarize labels speakers, whisper-1 provides timestamps. There is no free tier: a top-up of $5 or more is required. Included for comparison and for those who already have a key.',
  ),
  langs: { ru: 3, en: 3, kk: 1, mix: 3 },
  free: t('Платно: от $0,18/ч', 'Paid: from $0.18/h'),
  limits: [
    t('Нет бесплатного лимита — нужна предоплата от $5', 'No free tier — prepayment of $5 or more is required'),
    t('Файл до 25 МБ за запрос (BLA-БЛА режет сама)', 'Up to 25 MB per request (BLA-БЛА splits automatically)'),
    t('gpt-4o-transcribe не отдаёт таймкоды — для них выберите whisper-1', 'gpt-4o-transcribe returns no timestamps — choose whisper-1 for them'),
  ],
  pricing: t('mini ≈ $0,18/ч, gpt-4o-transcribe и whisper-1 ≈ $0,36/ч', 'mini ≈ $0.18/h, gpt-4o-transcribe and whisper-1 ≈ $0.36/h'),
  card: 'yes',
  keyUrl: 'https://platform.openai.com/api-keys',
  signupUrl: 'https://platform.openai.com/signup',
  docsUrl: 'https://platform.openai.com/docs/guides/speech-to-text',
  keySteps: [
    t('Войдите на https://platform.openai.com', 'Sign in at https://platform.openai.com'),
    t('Пополните баланс: Settings → Billing → Add to credit balance (от $5).', 'Top up: Settings → Billing → Add to credit balance ($5 minimum).'),
    t(
      'Откройте https://platform.openai.com/api-keys → «Create new secret key», скопируйте и вставьте ниже.',
      'Open https://platform.openai.com/api-keys → “Create new secret key”, copy it and paste it below.',
    ),
  ],
  keyPlaceholder: 'sk-…',
  maxBytes: 25 * 1024 ** 2,
  cors: 'yes',
  tags: ['ru-en', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: L_MODEL,
      default: 'gpt-4o-transcribe',
      options: [
        { value: 'gpt-4o-transcribe', label: t('gpt-4o-transcribe — самая точная (без таймкодов)', 'gpt-4o-transcribe — most accurate (no timestamps)') },
        { value: 'gpt-4o-mini-transcribe', label: t('gpt-4o-mini-transcribe — вдвое дешевле', 'gpt-4o-mini-transcribe — half the price') },
        { value: 'gpt-4o-transcribe-diarize', label: t('gpt-4o-transcribe-diarize — со спикерами', 'gpt-4o-transcribe-diarize — with speakers') },
        { value: 'whisper-1', label: t('whisper-1 — с таймкодами', 'whisper-1 — with timestamps') },
      ],
    },
    { kind: 'select', id: 'language', label: L_LANGUAGE, default: 'auto', options: LANG_OPTIONS_WHISPER },
    {
      kind: 'text',
      id: 'prompt',
      label: t('Подсказка (prompt)', 'Prompt'),
      hint: t('Термины и стиль. Не используется моделью diarize.', 'Terms and style. Not used by the diarize model.'),
      default: 'Разговор на русском с английскими терминами: deadline, feedback, pull request.',
      multiline: true,
    },
  ],
  async transcribe(file, fileName, ctx) {
    const model = String(ctx.settings.model || 'gpt-4o-transcribe')
    const diarize = model.includes('diarize')
    const r = await openaiTranscribe(BASE, file, fileName, ctx, {
      model,
      language: String(ctx.settings.language),
      prompt: diarize ? undefined : String(ctx.settings.prompt || ''),
      responseFormat: model === 'whisper-1' ? 'verbose_json' : diarize ? 'diarized_json' : 'json',
      extra: diarize ? { chunking_strategy: 'auto' } : undefined,
    })
    if (diarize && r.segments) {
      // diarized_json отдаёт спикеров как "A", "B"…
      r.segments = r.segments.map((s) => ({ ...s, speaker: speakerName(s.speaker) }))
      r.text = r.segments.map((s) => `${s.speaker ?? '—'}: ${s.text}`).join('\n')
    }
    return r
  },
  async checkLimits(ctx) {
    const { models, headers } = await openaiCheckKey(BASE, ctx)
    return {
      items: [
        { label: tx(L_KEY), value: tx(L_KEY_OK) },
        { label: tx(t('Модели распознавания', 'Transcription models')), value: models.filter((m) => /transcribe|whisper/.test(m)).join(', ') || '—' },
        ...Object.entries(headers ?? {}).map(([label, value]) => ({ label, value })),
      ],
      note: tx(t('Баланс — platform.openai.com/settings/organization/billing', 'Balance: platform.openai.com/settings/organization/billing')),
    }
  },
}
