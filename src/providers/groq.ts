import { openaiCheckKey, openaiTranscribe } from './openai-compatible'
import { L_KEY, L_KEY_OK, L_LANGUAGE, L_MODEL, LANG_OPTIONS_WHISPER } from './langs'
import type { Provider } from './types'
import { t, tx } from '@/lib/i18n'

const BASE = 'https://api.groq.com/openai/v1'

export const groq: Provider = {
  id: 'groq',
  name: 'Groq Whisper',
  vendor: 'Groq',
  tagline: t(
    'Whisper large-v3 на сверхбыстром железе. Бесплатно, без карты, час аудио — за секунды.',
    'Whisper large-v3 on ultra-fast hardware. Free, no card, an hour of audio in seconds.',
  ),
  description: t(
    'Groq запускает открытую модель OpenAI Whisper large-v3 на своих LPU-чипах: час записи распознаётся примерно за 10–20 секунд. Русский и английский — отлично, смешанную речь Whisper понимает, но иногда «переводит» вставки на основной язык (помогает подсказка-промпт). Казахский поддерживается, но заметно слабее. Самый простой старт: регистрация через Google/GitHub, ключ за минуту.',
    'Groq runs the open OpenAI Whisper large-v3 model on its LPU chips: an hour of audio is transcribed in roughly 10–20 seconds. Russian and English are excellent; Whisper handles mixed speech but sometimes “translates” inserted phrases into the main language (a prompt helps). Kazakh is supported but noticeably weaker. The easiest start: sign in with Google/GitHub, get a key in a minute.',
  ),
  langs: { ru: 3, en: 3, kk: 1, mix: 2 },
  free: t('Бесплатно: ~8 ч аудио в день', 'Free: ~8 h of audio per day'),
  limits: [
    t('Бесплатный план: 20 запросов/мин, 2 000 запросов/день', 'Free plan: 20 requests/min, 2,000 requests/day'),
    t('До 7 200 секунд аудио в час и 28 800 секунд (8 ч) в день', 'Up to 7,200 seconds of audio per hour and 28,800 seconds (8 h) per day'),
    t('Файл до 25 МБ за запрос (BLA-БЛА сама режет длинные записи)', 'Up to 25 MB per request (BLA-БЛА splits long recordings automatically)'),
  ],
  pricing: t('Developer-план: large-v3 ≈ $0,111/ч, large-v3-turbo ≈ $0,04/ч', 'Developer plan: large-v3 ≈ $0.111/h, large-v3-turbo ≈ $0.04/h'),
  card: 'no',
  keyUrl: 'https://console.groq.com/keys',
  signupUrl: 'https://console.groq.com/login',
  docsUrl: 'https://console.groq.com/docs/speech-to-text',
  keySteps: [
    t('Откройте https://console.groq.com и войдите через Google, GitHub или почту.', 'Open https://console.groq.com and sign in with Google, GitHub or email.'),
    t('Слева выберите «API Keys» → «Create API Key», придумайте любое имя.', 'In the sidebar choose “API Keys” → “Create API Key” and give it any name.'),
    t('Скопируйте ключ (начинается с gsk_) — он показывается один раз — и вставьте ниже.', 'Copy the key (starts with gsk_) — it is shown only once — and paste it below.'),
  ],
  keyPlaceholder: 'gsk_…',
  maxBytes: 25 * 1024 ** 2,
  cors: 'yes',
  tags: ['ru-en', 'kk', 'free', 'fast', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'model',
      label: L_MODEL,
      default: 'whisper-large-v3',
      options: [
        { value: 'whisper-large-v3', label: t('whisper-large-v3 — точнее, лучше для смешанной речи', 'whisper-large-v3 — more accurate, better for mixed speech') },
        { value: 'whisper-large-v3-turbo', label: t('whisper-large-v3-turbo — быстрее и дешевле', 'whisper-large-v3-turbo — faster and cheaper') },
      ],
    },
    {
      kind: 'select',
      id: 'language',
      label: L_LANGUAGE,
      hint: t(
        'Для смешанной RU+EN речи оставьте «Авто» или выберите основной язык разговора.',
        'For mixed RU+EN speech keep “Auto-detect” or choose the main language of the conversation.',
      ),
      default: 'auto',
      options: LANG_OPTIONS_WHISPER,
    },
    {
      kind: 'text',
      id: 'prompt',
      label: t('Подсказка (prompt)', 'Prompt'),
      hint: t(
        'Термины, имена, стиль. Пример смешанного текста помогает Whisper не переводить английские слова.',
        'Terms, names, style. A sample of mixed text helps Whisper keep English words untranslated.',
      ),
      default: 'Разговор на русском с английскими терминами: deadline, feedback, pull request, API.',
      multiline: true,
    },
    {
      kind: 'number',
      id: 'temperature',
      label: t('Температура', 'Temperature'),
      hint: t('0 — максимально точно.', '0 — most accurate.'),
      default: 0,
      min: 0,
      max: 1,
      step: 0.1,
    },
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
      { label: tx(L_KEY), value: tx(L_KEY_OK) },
      { label: tx(t('Whisper-модели', 'Whisper models')), value: models.filter((m) => m.includes('whisper')).join(', ') || '—' },
    ]
    for (const [k, v] of Object.entries(headers ?? {})) items.push({ label: k, value: v })
    return {
      items,
      note: tx(
        t(
          'Точный остаток Groq показывает в заголовках ответов и на console.groq.com/settings/limits.',
          'Groq reports exact remaining quota in response headers and at console.groq.com/settings/limits.',
        ),
      ),
    }
  },
}
