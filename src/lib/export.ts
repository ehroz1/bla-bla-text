import type { Segment, TranscriptResult } from '@/providers/types'

function ts(sec: number, sep: ',' | '.') {
  const ms = Math.max(0, Math.round(sec * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const r = ms % 1000
  const p = (n: number, l = 2) => n.toString().padStart(l, '0')
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`
}

function line(seg: Segment) {
  return seg.speaker ? `${seg.speaker}: ${seg.text.trim()}` : seg.text.trim()
}

export function toSrt(segments: Segment[]) {
  return segments
    .map((s, i) => `${i + 1}\n${ts(s.start, ',')} --> ${ts(s.end, ',')}\n${line(s)}\n`)
    .join('\n')
}

export function toVtt(segments: Segment[]) {
  return 'WEBVTT\n\n' + segments.map((s) => `${ts(s.start, '.')} --> ${ts(s.end, '.')}\n${line(s)}\n`).join('\n')
}

export function toTimestampedText(segments: Segment[]) {
  return segments.map((s) => `[${ts(s.start, '.').slice(0, 8)}] ${line(s)}`).join('\n')
}

export function download(content: string | Blob, fileName: string, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportResult(result: TranscriptResult, format: 'txt' | 'srt' | 'vtt' | 'json' | 'md', baseName: string) {
  const segs = result.segments ?? []
  switch (format) {
    case 'txt':
      return download(result.text, `${baseName}.txt`)
    case 'md':
      return download(
        `# ${baseName}\n\n` + (segs.length ? toTimestampedText(segs).replace(/\n/g, '  \n') : result.text) + '\n',
        `${baseName}.md`,
        'text/markdown;charset=utf-8',
      )
    case 'srt':
      return download(toSrt(segs), `${baseName}.srt`, 'application/x-subrip;charset=utf-8')
    case 'vtt':
      return download(toVtt(segs), `${baseName}.vtt`, 'text/vtt;charset=utf-8')
    case 'json':
      return download(JSON.stringify(result, null, 2), `${baseName}.json`, 'application/json')
  }
}

/** Склейка результатов нескольких кусков в один, со сдвигом таймкодов. */
export function mergeResults(parts: { offset: number; result: TranscriptResult }[]): TranscriptResult {
  if (parts.length === 1 && parts[0].offset === 0) return parts[0].result
  const segments: Segment[] = []
  for (const { offset, result } of parts) {
    for (const s of result.segments ?? []) segments.push({ ...s, start: s.start + offset, end: s.end + offset })
  }
  return {
    text: parts
      .map((p) => p.result.text.trim())
      .filter(Boolean)
      .join('\n\n'),
    segments: segments.length ? segments : undefined,
    language: parts.find((p) => p.result.language)?.result.language,
    rateLimit: parts.at(-1)?.result.rateLimit,
    raw: parts.map((p) => p.result.raw),
  }
}
