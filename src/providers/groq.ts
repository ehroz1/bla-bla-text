import { openaiCheckKey, openaiTranscribe } from './openai-compatible'
import { LANG_OPTIONS_WHISPER } from './langs'
import type { Provider } from './types'

const BASE = 'https://api.groq.com/openai/v1'

export const groq: Provider = {
  id: 'groq',
  name: 'Groq Whisper',
  vendor: 'Groq',
  tagline: 'Whisper large-v3 на сверхбыстром железе. Бесплатно, без карты, час аудио — за секунды.',
  description:
    'Groq запускает открытую модель OpenAI Whisper large-v3 на своих LPU-чипах: час записи распознаётся примерно за 10–20 секунд. Русский и английский — отлично, смешанную речь Whisper понимает, но иногда «переводит» вставки на основной язык (помогает подсказка-промпт). Казахский поддерживается, но заметно слабее. Самый простой старт: регистрация через Google/GitHub, ключ за минуту.',
  langs: { ru: 3, en: 3, kk: 1, mix: 2 },
  free: 'Бесплатно: ~8 ч аудио в день',
  limits: [
    'Бесплатный план: 20 запросов/мин, 2 000 запросов/день',
    'До 7 200 секунд аудио в час и 28 800 секунд (8 ч) в день',
    'Файл до 25 МБ за запрос (BLA-БЛА сама режет длинные записи)',
  ],
  pricing: 'Developer-план: large-v3 ≈ $0,111/ч, large-v3-turbo ≈ $0,04/ч',
  card: 'не нужна',
  keyUrl: 'https://console.groq.com/keys',
  signupUrl: 'https://console.groq.com/login',
  docsUrl: 'https://console.groq.com/docs/speech-to-text',
  keySteps: [
    'Откройте https://console.groq.com и войдите через Google, GitHub или почту.',
    'Слева выберите «API Keys» → «Create API Key», придумайте любое имя.',
    'Скопируйте ключ (начинается с gsk_) — он показывается один раз — и вставьте ниже.',
  ],
  keyPlaceholder: 'gsk_…',
  maxBytes: 25 * 1024 ** 2,
  cors: 'yes',
  tags: ['ru-en', 'kk', 'free', 'fast', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: 'Модель',
      default: 'whisper-large-v3',
      options: [
        { value: 'whisper-large-v3', label: 'whisper-large-v3 — точнее, лучше для смешанной речи' },
        { value: 'whisper-large-v3-turbo', label: 'whisper-large-v3-turbo — быстрее и дешевле' },
      ],
    },
    {
      kind: 'select',
      id: 'language',
      label: 'Язык',
      hint: 'Для смешанной RU+EN речи оставьте «Авто» или выберите основной язык разговора.',
      default: 'auto',
      options: LANG_OPTIONS_WHISPER,
    },
    {
      kind: 'text',
      id: 'prompt',
      label: 'Подсказка (prompt)',
      hint: 'Термины, имена, стиль. Пример смешанного текста помогает Whisper не переводить английские слова.',
      default: 'Разговор на русском с английскими терминами: deadline, feedback, pull request, API.',
      multiline: true,
    },
    { kind: 'number', id: 'temperature', label: 'Температура', hint: '0 — максимально точно.', default: 0, min: 0, max: 1, step: 0.1 },
  ],
  transcribe: (file, fileName, ctx) =>
    openaiTranscribe(BASE, file, fileName, ctx, {
      model: String(ctx.settings.model || 'whisper-large-v3'),
      language: String(ctx.settings.language),
      prompt: String(ctx.settings.prompt || ''),
      temperature: Number(ctx.settings.temperature ?? 0),
      responseFormat: 'verbose_json',
    }),
  async checkLimits(ctx) {
    const { models, headers } = await openaiCheckKey(BASE, ctx)
    const items = [
      { label: 'Ключ', value: 'работает ✓' },
      { label: 'Whisper-модели', value: models.filter((m) => m.includes('whisper')).join(', ') || '—' },
    ]
    for (const [k, v] of Object.entries(headers ?? {})) items.push({ label: k, value: v })
    return {
      items,
      note: 'Точный остаток Groq показывает в заголовках каждого ответа (видны в результате) и на console.groq.com/settings/limits.',
    }
  },
}
