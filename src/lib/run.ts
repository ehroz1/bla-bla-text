import { type AudioChunk, type PrepareMode, prepareChunks } from '@/lib/audio'
import { mergeResults } from '@/lib/export'
import type { Provider, SettingValues, TranscriptResult } from '@/providers/types'

export interface RunOptions {
  file: File
  duration?: number
  provider: Provider
  apiKey: string
  settings: SettingValues
  prepare: PrepareMode
  fetch: typeof fetch
  signal: AbortSignal
  onStatus: (status: string, progress?: number) => void
}

export async function runTranscription(o: RunOptions): Promise<{ result: TranscriptResult; chunks: AudioChunk[] }> {
  // Подготовка занимает первые 30% прогресса, распознавание — остальные 70%.
  const chunks = await prepareChunks(o.file, {
    mode: o.prepare,
    maxBytes: o.provider.maxBytes,
    maxChunkSeconds: o.provider.maxChunkSeconds,
    duration: o.duration,
    signal: o.signal,
    onStatus: (s, p) => o.onStatus(s, p != null ? p * 0.3 : undefined),
  })

  const parts: { offset: number; result: TranscriptResult }[] = []
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    const label = chunks.length > 1 ? `Часть ${i + 1} из ${chunks.length}: ` : ''
    const base = 0.3 + (0.7 * i) / chunks.length
    o.onStatus(`${label}отправляю в ${o.provider.name}…`, base)
    const result = await o.provider.transcribe(c.blob, c.fileName, {
      apiKey: o.apiKey,
      settings: o.settings,
      signal: o.signal,
      fetch: o.fetch,
      onStatus: (s) => o.onStatus(label + s, base),
    })
    parts.push({ offset: c.start, result })
  }
  o.onStatus('Готово', 1)
  return { result: mergeResults(parts), chunks }
}
