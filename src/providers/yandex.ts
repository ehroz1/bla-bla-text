import { poll, request, requestJson } from './http'
import { segmentsToText } from './segments'
import type { Provider, Segment } from './types'
import { t, tx } from '@/lib/i18n'

const STT = 'https://stt.api.cloud.yandex.net/stt/v3'
const OPS = 'https://operation.api.cloud.yandex.net/operations'

const LANGS: Record<string, string[]> = {
  auto: [],
  'kk-ru': ['kk-KZ', 'ru-RU'],
  'ru-en': ['ru-RU', 'en-US'],
  ru: ['ru-RU'],
  kk: ['kk-KZ'],
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',', 2)[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

interface Alt {
  text: string
  startTimeMs?: string | number
  endTimeMs?: string | number
  languages?: { languageCode: string; probability: number }[]
}
interface StreamLine {
  result?: {
    channelTag?: string
    final?: { alternatives?: Alt[] }
    finalRefinement?: { finalIndex?: string; normalizedText?: { alternatives?: Alt[] } }
    speakerAnalysis?: unknown
  }
  error?: { message?: string }
}

export const yandex: Provider = {
  id: 'yandex',
  name: 'Yandex SpeechKit',
  vendor: 'Yandex Cloud',
  tagline: t(
    'Сильный русский и казахский (kk-KZ), автоопределение языка. Нужен CORS-прокси.',
    'Strong Russian and Kazakh (kk-KZ), language auto-detection. Needs a CORS proxy.',
  ),
  description: t(
    'SpeechKit от Yandex Cloud — один из лучших распознавателей для русского языка, отдельно поддерживает казахский (kk-KZ) и умеет определять язык каждой фразы. Работает в Казахстане (yandex.cloud/kz). Минусы: регистрация сложнее (платёжный аккаунт, сервисный аккаунт) и API не пускает запросы из браузера — нужен свой CORS-прокси. Новым пользователям Yandex Cloud даёт стартовый грант.',
    'Yandex Cloud SpeechKit is one of the best recognizers for Russian, separately supports Kazakh (kk-KZ) and can detect the language of each phrase. Available in Kazakhstan (yandex.cloud/kz). Downsides: sign-up is more involved (billing account, service account) and the API rejects browser requests — you need your own CORS proxy. New Yandex Cloud users get a starter grant.',
  ),
  langs: { ru: 3, en: 2, kk: 3, mix: 2 },
  free: t('Стартовый грант Yandex Cloud', 'Yandex Cloud starter grant'),
  limits: [
    t(
      'Новым аккаунтам — стартовый грант (сумма и срок — на странице yandex.cloud/ru/docs/getting-started/free-trial)',
      'New accounts get a starter grant (amount and duration: yandex.cloud/en/docs/getting-started/free-trial)',
    ),
    t('Нужен платёжный аккаунт (карта привязывается, списаний в рамках гранта нет)', 'A billing account is required (a card is linked, but nothing is charged within the grant)'),
    t('Файл до 10 МБ на запрос в этом режиме — BLA-БЛА режет на части', 'Up to 10 MB per request in this mode — BLA-БЛА splits files into parts'),
    t('Только через свой CORS-прокси', 'Only through your own CORS proxy'),
  ],
  pricing: t('Асинхронное распознавание ≈ 0,15–0,20 ₽ за 15 секунд', 'Async recognition ≈ 0.15–0.20 ₽ per 15 seconds'),
  card: 'hold',
  keyUrl: 'https://console.yandex.cloud/',
  signupUrl: 'https://yandex.cloud/ru/docs/billing/quickstart/',
  docsUrl: 'https://yandex.cloud/ru/docs/speechkit/stt/api/transcribation-api-v3',
  keySteps: [
    t(
      'Войдите в https://console.yandex.cloud (Яндекс ID) и создайте платёжный аккаунт — активируется стартовый грант.',
      'Sign in to https://console.yandex.cloud (Yandex ID) and create a billing account — the starter grant is activated.',
    ),
    t('В каталоге: «Сервисные аккаунты» → «Создать», роль ai.speechkit-stt.user.', 'In your folder: “Service accounts” → “Create”, role ai.speechkit-stt.user.'),
    t(
      'Откройте сервисный аккаунт → «Создать новый ключ» → «API-ключ» (область действия yc.ai.speechkitStt.execute).',
      'Open the service account → “Create new key” → “API key” (scope yc.ai.speechkitStt.execute).',
    ),
    t('Скопируйте секретную часть ключа (AQVN…) и вставьте ниже.', 'Copy the secret part of the key (AQVN…) and paste it below.'),
    t('Разверните CORS-прокси (вкладка «Настройки») и включите его для Yandex.', 'Deploy the CORS proxy (Settings tab) and enable it for Yandex.'),
  ],
  keyPlaceholder: 'AQVN…',
  maxBytes: 10 * 1024 ** 2,
  cors: 'no',
  tags: ['ru-en', 'kk', 'cis', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'languages',
      label: t('Языки', 'Languages'),
      default: 'kk-ru',
      options: [
        { value: 'kk-ru', label: t('Казахский + русский', 'Kazakh + Russian') },
        { value: 'ru-en', label: t('Русский + английский', 'Russian + English') },
        { value: 'auto', label: t('Авто (любой язык)', 'Auto (any language)') },
        { value: 'ru', label: t('Русский', 'Russian') },
        { value: 'kk', label: t('Казахский', 'Kazakh') },
      ],
    },
    {
      kind: 'toggle',
      id: 'literature',
      label: t('Литературная запись', 'Literary formatting'),
      hint: t('Пунктуация, цифры, без «э-э».', 'Punctuation, digits, no “uh”.'),
      default: true,
    },
    { kind: 'toggle', id: 'profanity', label: t('Скрывать мат', 'Mask profanity'), default: false },
  ],
  async transcribe(file, _name, ctx) {
    const s = ctx.settings
    const auth = { Authorization: `Api-Key ${ctx.apiKey}` }
    const containerAudioType = file.type.includes('wav') ? 'WAV' : file.type.includes('ogg') ? 'OGG_OPUS' : 'MP3'
    const codes = LANGS[String(s.languages)] ?? []
    ctx.onStatus(tx(t('Кодирую аудио…', 'Encoding audio…')))
    const content = await blobToBase64(file)
    const body = {
      content,
      recognitionModel: {
        model: 'general',
        audioFormat: { containerAudio: { containerAudioType } },
        textNormalization: {
          textNormalization: 'TEXT_NORMALIZATION_ENABLED',
          profanityFilter: !!s.profanity,
          literatureText: !!s.literature,
        },
        ...(codes.length ? { languageRestriction: { restrictionType: 'WHITELIST', languageCode: codes } } : {}),
        audioProcessingType: 'FULL_DATA',
      },
    }
    ctx.onStatus(tx(t('Отправляю…', 'Sending…')))
    const { data: op } = await requestJson<{ id: string }>(ctx, `${STT}/recognizeFileAsync`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await poll(ctx, async () => {
      const { data } = await requestJson<{ done?: boolean; error?: { message?: string } }>(ctx, `${OPS}/${op.id}`, { headers: auth })
      if (data.error) throw new Error(`SpeechKit: ${data.error.message}`)
      return { done: !!data.done, status: data.done ? tx(t('готово', 'done')) : tx(t('в очереди', 'queued')) }
    })
    const res = await request(ctx, `${STT}/getRecognition?operationId=${encodeURIComponent(op.id)}`, { headers: auth })
    const raw = await res.text()
    const lines: StreamLine[] = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as StreamLine
        } catch {
          return {}
        }
      })
    const pick = (alt: Alt | undefined): Segment | null =>
      alt?.text?.trim() ? { start: Number(alt.startTimeMs ?? 0) / 1000, end: Number(alt.endTimeMs ?? 0) / 1000, text: alt.text.trim() } : null
    const refined = lines
      .filter((l) => (l.result?.channelTag ?? '0') === '0')
      .map((l) => pick(l.result?.finalRefinement?.normalizedText?.alternatives?.[0]))
      .filter((x): x is Segment => !!x)
    const finals = lines
      .filter((l) => (l.result?.channelTag ?? '0') === '0')
      .map((l) => pick(l.result?.final?.alternatives?.[0]))
      .filter((x): x is Segment => !!x)
    const segments = refined.length ? refined : finals
    const langs = new Set(
      lines.flatMap((l) => l.result?.final?.alternatives?.[0]?.languages?.filter((x) => x.probability > 0.5).map((x) => x.languageCode) ?? []),
    )
    return { text: segmentsToText(segments), segments, language: [...langs].join(', ') || undefined, raw: lines }
  },
}
