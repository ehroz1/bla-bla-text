import { openaiCheckKey, openaiTranscribe } from './openai-compatible'
import { LANG_OPTIONS_WHISPER } from './langs'
import { speakerName } from './segments'
import type { Provider } from './types'

const BASE = 'https://api.openai.com/v1'

export const openai: Provider = {
  id: 'openai',
  name: 'OpenAI',
  vendor: 'OpenAI',
  tagline: 'gpt-4o-transcribe и Whisper — эталон качества. Платно: бесплатного лимита нет.',
  description:
    'Оригинальные модели OpenAI. gpt-4o-transcribe заметно точнее Whisper на смешанной речи и шумных записях, gpt-4o-transcribe-diarize размечает спикеров, whisper-1 даёт таймкоды. Бесплатного тарифа нет: нужно пополнить баланс от $5. Добавлен для сравнения и тем, у кого ключ уже есть.',
  langs: { ru: 3, en: 3, kk: 1, mix: 3 },
  free: 'Платно: от $0,18/ч',
  limits: ['Нет бесплатного лимита — нужна предоплата от $5', 'Файл до 25 МБ за запрос (BLA-БЛА режет сама)', 'gpt-4o-transcribe не отдаёт таймкоды — для них выберите whisper-1'],
  pricing: 'mini ≈ $0,18/ч, gpt-4o-transcribe и whisper-1 ≈ $0,36/ч',
  card: 'нужна',
  keyUrl: 'https://platform.openai.com/api-keys',
  signupUrl: 'https://platform.openai.com/signup',
  docsUrl: 'https://platform.openai.com/docs/guides/speech-to-text',
  keySteps: [
    'Войдите на https://platform.openai.com',
    'Пополните баланс: Settings → Billing → Add to credit balance (от $5).',
    'Откройте https://platform.openai.com/api-keys → «Create new secret key», скопируйте и вставьте ниже.',
  ],
  keyPlaceholder: 'sk-…',
  maxBytes: 25 * 1024 ** 2,
  cors: 'yes',
  tags: ['ru-en', 'diarization', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: 'Модель',
      default: 'gpt-4o-transcribe',
      options: [
        { value: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe — самая точная (без таймкодов)' },
        { value: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe — вдвое дешевле' },
        { value: 'gpt-4o-transcribe-diarize', label: 'gpt-4o-transcribe-diarize — со спикерами' },
        { value: 'whisper-1', label: 'whisper-1 — с таймкодами' },
      ],
    },
    { kind: 'select', id: 'language', label: 'Язык', default: 'auto', options: LANG_OPTIONS_WHISPER },
    {
      kind: 'text',
      id: 'prompt',
      label: 'Подсказка (prompt)',
      hint: 'Термины и стиль. Не используется моделью diarize.',
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
        { label: 'Ключ', value: 'работает ✓' },
        { label: 'Модели распознавания', value: models.filter((m) => /transcribe|whisper/.test(m)).join(', ') || '—' },
        ...Object.entries(headers ?? {}).map(([label, value]) => ({ label, value })),
      ],
      note: 'Баланс — platform.openai.com/settings/organization/billing',
    }
  },
}
