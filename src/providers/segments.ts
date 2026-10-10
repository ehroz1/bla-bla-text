import type { Segment } from './types'
import { t, tx } from '@/lib/i18n'

export interface TimedWord {
  text: string
  start: number
  end: number
  speaker?: string
}

/**
 * Собирает слова в фразы: новая фраза — после конца предложения, при смене спикера
 * или паузе. `spaced` — слова уже содержат пробелы (ElevenLabs, Soniox).
 */
export function wordsToSegments(words: TimedWord[], { spaced = false, maxWords = 40, gap = 1.5 } = {}): Segment[] {
  const out: Segment[] = []
  let cur: { start: number; end: number; parts: string[]; speaker?: string; count: number } | null = null
  const flush = () => {
    if (cur) {
      const text = (spaced ? cur.parts.join('') : cur.parts.join(' ')).replace(/\s+([,.!?;:…])/g, '$1').trim()
      if (text) out.push({ start: cur.start, end: cur.end, text, speaker: cur.speaker })
    }
    cur = null
  }
  for (const w of words) {
    if (!w.text) continue
    const isPunct = /^[\s,.!?;:…»)"'-]+$/.test(w.text)
    if (cur && !isPunct && (w.speaker !== cur.speaker || w.start - cur.end > gap || cur.count >= maxWords)) flush()
    if (!cur) {
      if (isPunct && out.length) {
        out[out.length - 1].text += w.text.trim()
        continue
      }
      cur = { start: w.start, end: w.end, parts: [], speaker: w.speaker, count: 0 }
    }
    if (!spaced && isPunct && cur.parts.length) cur.parts[cur.parts.length - 1] += w.text.trim()
    else cur.parts.push(w.text)
    cur.end = Math.max(cur.end, w.end)
    cur.count++
    if (/[.!?…]["»)]?\s*$/.test(w.text) && cur.count >= 4) flush()
  }
  flush()
  return out
}

/** Текст абзацами по спикерам (если они есть) или сплошной. */
export function segmentsToText(segments: Segment[]): string {
  if (!segments.some((s) => s.speaker)) return segments.map((s) => s.text).join(' ').trim()
  let text = ''
  let last: string | undefined = '\u0000'
  for (const s of segments) {
    if (s.speaker !== last) {
      text += `${text ? '\n\n' : ''}${s.speaker ?? '—'}: `
      last = s.speaker
    } else text += ' '
    text += s.text
  }
  return text.trim()
}

/** "speaker_0" / 0 / "S1" / "A" -> "Спикер N" / "Speaker N". `base` — с какого числа сервис нумерует спикеров. */
export function speakerName(id: string | number | undefined | null, base: 0 | 1 = 0): string | undefined {
  if (id == null || id === '') return undefined
  const s = String(id)
  const word = tx(t('Спикер', 'Speaker'))
  if (/^[A-Z]$/.test(s)) return `${word} ${s.charCodeAt(0) - 64}`
  const m = s.match(/(\d+)$/)
  return m ? `${word} ${Number(m[1]) - base + 1}` : `${word} ${s}`
}
