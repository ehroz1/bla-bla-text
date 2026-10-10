// Minimal i18n without dependencies. The active language is a module-level value so that
// non-React code (providers, audio processing, error messages) can translate too;
// App re-renders the whole tree when it changes.

export type Lang = 'ru' | 'en'

/** Bilingual text. A plain string is shown as-is in both languages (names, examples). */
export type L = { ru: string; en: string }
export type Text = L | string

/** Shorthand for writing bilingual literals: t('Привет', 'Hello'). */
export const t = (ru: string, en: string): L => ({ ru, en })

let current: Lang = 'ru'

export function detectLang(): Lang {
  try {
    const nav = navigator.languages?.[0] ?? navigator.language ?? ''
    return /^(ru|kk|uk|be|ky|uz|tg)\b/i.test(nav) ? 'ru' : 'en'
  } catch {
    return 'en'
  }
}

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  current = lang
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}

/** Translate a bilingual value into the active language. */
export function tx(value: Text | undefined | null): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : value[current]
}

/** Translate with {placeholders}. */
export function tf(value: Text, vars: Record<string, string | number>): string {
  return tx(value).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

export function locale(): string {
  return current === 'ru' ? 'ru-RU' : 'en-US'
}
