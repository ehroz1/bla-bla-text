import type { Text } from '@/lib/i18n'

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
      label: Text
      hint?: Text
      default: string
      options: { value: string; label: Text }[]
    }
  | { kind: 'toggle'; id: string; label: Text; hint?: Text; default: boolean }
  | { kind: 'text'; id: string; label: Text; hint?: Text; default: string; placeholder?: string; multiline?: boolean }
  | { kind: 'number'; id: string; label: Text; hint?: Text; default: number; min?: number; max?: number; step?: number }

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
  vendor: Text
  /** Короткое описание для карточки. */
  tagline: Text
  description: Text
  langs: { ru: Level; en: Level; kk: Level; mix: Level }
  /** Бесплатный тариф — одна строка для карточки. */
  free: Text
  limits: Text[]
  pricing: Text
  /** Нужна ли банковская карта: no — нет, yes — да, hold — привязать без списания. */
  card: 'no' | 'yes' | 'hold'
  keyUrl: string
  signupUrl: string
  docsUrl: string
  keySteps: Text[]
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
