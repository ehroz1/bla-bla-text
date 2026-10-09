import { poll, request, requestJson } from './http'
import { segmentsToText } from './segments'
import type { Provider, Segment } from './types'

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
  tagline: 'Сильный русский и казахский (kk-KZ), автоопределение языка. Нужен CORS-прокси.',
  description:
    'SpeechKit от Yandex Cloud — один из лучших распознавателей для русского языка, отдельно поддерживает казахский (kk-KZ) и умеет определять язык каждой фразы. Работает в Казахстане (yandex.cloud/kz). Минусы: регистрация сложнее (платёжный аккаунт, сервисный аккаунт) и API не пускает запросы из браузера — нужен свой CORS-прокси. Новым пользователям Yandex Cloud даёт стартовый грант.',
  langs: { ru: 3, en: 2, kk: 3, mix: 2 },
  free: 'Стартовый грант Yandex Cloud',
  limits: [
    'Новым аккаунтам — стартовый грант (сумма и срок — на странице yandex.cloud/ru/docs/getting-started/free-trial)',
    'Нужен платёжный аккаунт (карта привязывается, списаний в рамках гранта нет)',
    'Файл до 10 МБ на запрос в этом режиме — BLA-БЛА режет на части',
    'Только через свой CORS-прокси',
  ],
  pricing: 'Асинхронное распознавание ≈ 0,15–0,20 ₽ за 15 секунд',
  card: 'нужна (без списания)',
  keyUrl: 'https://console.yandex.cloud/',
  signupUrl: 'https://yandex.cloud/ru/docs/billing/quickstart/',
  docsUrl: 'https://yandex.cloud/ru/docs/speechkit/stt/api/transcribation-api-v3',
  keySteps: [
    'Войдите в https://console.yandex.cloud (Яндекс ID) и создайте платёжный аккаунт — активируется стартовый грант.',
    'В каталоге: «Сервисные аккаунты» → «Создать», роль ai.speechkit-stt.user.',
    'Откройте сервисный аккаунт → «Создать новый ключ» → «API-ключ» (область действия yc.ai.speechkitStt.execute).',
    'Скопируйте секретную часть ключа (AQVN…) и вставьте ниже.',
    'Разверните CORS-прокси (вкладка «Настройки») и включите его для Yandex.',
  ],
  keyPlaceholder: 'AQVN…',
  maxBytes: 10 * 1024 ** 2,
  cors: 'no',
  tags: ['ru-en', 'kk', 'cis', 'timestamps'],
  settings: [
    {
      kind: 'select',
      id: 'languages',
      label: 'Языки',
      default: 'kk-ru',
      options: [
        { value: 'kk-ru', label: 'Казахский + русский' },
        { value: 'ru-en', label: 'Русский + английский' },
        { value: 'auto', label: 'Авто (любой язык)' },
        { value: 'ru', label: 'Русский' },
        { value: 'kk', label: 'Казахский' },
      ],
    },
    { kind: 'toggle', id: 'literature', label: 'Литературная запись', hint: 'Пунктуация, цифры, без «э-э».', default: true },
    { kind: 'toggle', id: 'profanity', label: 'Скрывать мат', default: false },
  ],
  async transcribe(file, _name, ctx) {
    const s = ctx.settings
    const auth = { Authorization: `Api-Key ${ctx.apiKey}` }
    const containerAudioType = file.type.includes('wav') ? 'WAV' : file.type.includes('ogg') ? 'OGG_OPUS' : 'MP3'
    const codes = LANGS[String(s.languages)] ?? []
    ctx.onStatus('Кодирую аудио…')
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
    ctx.onStatus('Отправляю…')
    const { data: op } = await requestJson<{ id: string }>(ctx, `${STT}/recognizeFileAsync`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await poll(ctx, async () => {
      const { data } = await requestJson<{ done?: boolean; error?: { message?: string } }>(ctx, `${OPS}/${op.id}`, { headers: auth })
      if (data.error) throw new Error(`SpeechKit: ${data.error.message}`)
      return { done: !!data.done, status: data.done ? 'готово' : 'в очереди' }
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
