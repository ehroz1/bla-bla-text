export type Level = 0 | 1 | 2 | 3 // 0 = нет, 1 = слабо, 2 = хорошо, 3 = отлично

export interface Segment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface TranscriptResult {
  text: string
  segments?: Segment[]
  language?: string
  /** Длительность аудио, сек — если сервис её вернул. */
  duration?: number
  /** Что сервис сообщил о лимитах в заголовках ответа. */
  rateLimit?: Record<string, string>
  raw?: unknown
}

export type SettingDef =
  | {
      kind: 'select'
      id: string
      label: string
      hint?: string
      default: string
      options: { value: string; label: string }[]
    }
  | { kind: 'toggle'; id: string; label: string; hint?: string; default: boolean }
  | { kind: 'text'; id: string; label: string; hint?: string; default: string; placeholder?: string; multiline?: boolean }
  | { kind: 'number'; id: string; label: string; hint?: string; default: number; min?: number; max?: number; step?: number }

export type SettingValues = Record<string, string | number | boolean>

export interface LimitInfo {
  /** Пары «название — значение», показываются как есть. */
  items: { label: string; value: string; progress?: number }[]
  note?: string
}

export interface ProviderContext {
  apiKey: string
  settings: SettingValues
  signal: AbortSignal
  /** fetch с учётом CORS-прокси (если пользователь его включил). */
  fetch: typeof fetch
  onStatus: (status: string) => void
}

export interface Provider {
  id: string
  name: string
  vendor: string
  /** Короткое описание для карточки. */
  tagline: string
  description: string
  langs: { ru: Level; en: Level; kk: Level; mix: Level }
  /** Бесплатный тариф — одна строка для карточки. */
  free: string
  limits: string[]
  pricing: string
  card: 'не нужна' | 'нужна' | 'нужна (без списания)'
  keyUrl: string
  signupUrl: string
  docsUrl: string
  keySteps: string[]
  keyPlaceholder: string
  /** Максимальный размер одного запроса, байт. */
  maxBytes: number
  /** Ограничение длительности одного куска, сек (для LLM-моделей и т.п.). */
  maxChunkSeconds?: number
  /** Может ли браузер обратиться к API напрямую. */
  cors: 'yes' | 'no' | 'unknown'
  tags: ('ru-en' | 'kk' | 'free' | 'fast' | 'diarization' | 'timestamps' | 'llm' | 'cis')[]
  settings: SettingDef[]
  transcribe(file: Blob, fileName: string, ctx: ProviderContext): Promise<TranscriptResult>
  /** Проверить ключ и показать лимиты/баланс, если API это позволяет. */
  checkLimits?(ctx: Omit<ProviderContext, 'onStatus' | 'settings'>): Promise<LimitInfo>
}
