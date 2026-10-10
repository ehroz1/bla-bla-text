import { t } from '@/lib/i18n'

export const LANG_OPTIONS_WHISPER = [
  { value: 'auto', label: t('Авто (определить)', 'Auto-detect') },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'kk', label: 'Қазақша' },
  { value: 'uk', label: 'Українська' },
  { value: 'uz', label: 'Oʻzbek' },
  { value: 'de', label: 'Deutsch' },
  { value: 'tr', label: 'Türkçe' },
]

/** Общие подписи настроек, которые повторяются у разных сервисов. */
export const L_DIARIZE = t('Разделять спикеров', 'Separate speakers')
export const L_LANGUAGE = t('Язык', 'Language')
export const L_MODEL = t('Модель', 'Model')
export const L_KEY = t('Ключ', 'Key')
export const L_KEY_OK = t('работает ✓', 'works ✓')
export const L_THIS_MONTH = t('В этом месяце', 'This month')
export const L_SPEAKERS = t('Сколько спикеров', 'Number of speakers')

/** Подпись для поля Provider.card. */
export const CARD_TEXT = {
  no: t('не нужна', 'not required'),
  yes: t('нужна', 'required'),
  hold: t('нужна (без списания)', 'required (no charge)'),
} as const
