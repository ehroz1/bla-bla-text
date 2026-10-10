// Client-side media preparation: extract the audio track from any audio/video file,
// downmix to mono 16 kHz, compress to MP3 (or WAV) and split into chunks that fit
// the selected provider's upload limit. Everything happens in the browser.
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  Input,
  Mp3OutputFormat,
  Output,
  WavOutputFormat,
} from 'mediabunny'
import { t, tf, tx } from '@/lib/i18n'

export type PrepareMode = 'mp3' | 'wav' | 'original'

export interface MediaInfo {
  duration?: number
  hasAudio: boolean
  hasVideo: boolean
  mimeType?: string
  audioCodec?: string | null
  sampleRate?: number
  channels?: number
}

export interface AudioChunk {
  blob: Blob
  fileName: string
  mimeType: string
  /** Offset of this chunk in the original media, seconds. */
  start: number
  end: number
}

const SAMPLE_RATE = 16000
const MP3_BITRATE = 48_000
const BYTES_PER_SEC: Record<Exclude<PrepareMode, 'original'>, number> = {
  mp3: MP3_BITRATE / 8,
  wav: SAMPLE_RATE * 2, // 16-bit mono PCM
}

let mp3Ready: Promise<void> | null = null
function ensureMp3Encoder(): Promise<void> {
  mp3Ready ??= (async () => {
    if (!(await canEncodeAudio('mp3'))) {
      const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder')
      registerMp3Encoder()
    }
  })()
  return mp3Ready
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '') || 'audio'
}

/** Read duration and tracks. Falls back to an <audio> element when the container is unknown. */
export async function probeMedia(file: Blob): Promise<MediaInfo> {
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    try {
      const [audio, video, mimeType] = await Promise.all([
        input.getPrimaryAudioTrack(),
        input.getPrimaryVideoTrack(),
        input.getMimeType(),
      ])
      const duration = await input.computeDuration()
      return {
        duration,
        hasAudio: !!audio,
        hasVideo: !!video,
        mimeType,
        audioCodec: audio?.codec ?? null,
        sampleRate: audio?.sampleRate,
        channels: audio?.numberOfChannels,
      }
    } finally {
      input.dispose()
    }
  } catch {
    const duration = await durationFromElement(file).catch(() => undefined)
    return { duration, hasAudio: true, hasVideo: file.type.startsWith('video/'), mimeType: file.type }
  }
}

function durationFromElement(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (Number.isFinite(el.duration)) resolve(el.duration)
      else reject(new Error('unknown duration'))
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('cannot read media'))
    }
    el.src = url
  })
}

interface ConvertOpts {
  mode: Exclude<PrepareMode, 'original'>
  start?: number
  end?: number
  onProgress?: (p: number) => void
  signal?: AbortSignal
}

/** Transcode (a slice of) any media file into a mono 16 kHz MP3/WAV using mediabunny + WebCodecs. */
async function convertWithMediabunny(file: Blob, opts: ConvertOpts): Promise<Blob> {
  if (opts.mode === 'mp3') await ensureMp3Encoder()
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const target = new BufferTarget()
  const output = new Output({
    format: opts.mode === 'mp3' ? new Mp3OutputFormat() : new WavOutputFormat(),
    target,
  })
  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      showWarnings: false,
      video: { discard: true },
      audio: {
        numberOfChannels: 1,
        sampleRate: SAMPLE_RATE,
        ...(opts.mode === 'mp3' ? { codec: 'mp3' as const, bitrate: MP3_BITRATE } : { codec: 'pcm-s16' as const }),
      },
      trim: opts.start != null || opts.end != null ? { start: opts.start, end: opts.end } : undefined,
    })
    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map((d) => `${d.track.type}: ${d.reason}`).join(', ')
      throw new Error(tf(t('Браузер не может декодировать этот файл ({r})', 'The browser cannot decode this file ({r})'), { r: reasons || tx(t('нет аудиодорожки', 'no audio track')) }))
    }
    if (opts.onProgress) conversion.onProgress = (p) => opts.onProgress!(p)
    const onAbort = () => void conversion.cancel()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      await conversion.execute()
    } finally {
      opts.signal?.removeEventListener('abort', onAbort)
    }
    if (opts.signal?.aborted) throw new DOMException(tx(t('Отменено', 'Cancelled')), 'AbortError')
    return new Blob([target.buffer!], { type: opts.mode === 'mp3' ? 'audio/mpeg' : 'audio/wav' })
  } finally {
    input.dispose()
  }
}

// ---------- Fallback: Web Audio decode + WAV encode (works where WebCodecs can't decode) ----------

async function decodeToMono16k(file: Blob): Promise<Float32Array> {
  const buf = await file.arrayBuffer()
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(buf)
  } finally {
    void ctx.close()
  }
  const frames = Math.ceil(decoded.duration * SAMPLE_RATE)
  const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

// ---------- Public API ----------

/** Число кусков; хвост короче 15 с приклеивается к последнему куску. */
function chunkCount(total: number, chunkSec: number) {
  const n = Math.max(1, Math.ceil(total / chunkSec))
  return n > 1 && total - (n - 1) * chunkSec < 15 ? n - 1 : n
}

export interface PrepareOptions {
  mode: PrepareMode
  /** Max upload size accepted by the provider, bytes. */
  maxBytes: number
  /** Optional hard cap on a chunk's duration, seconds (some models degrade on long inputs). */
  maxChunkSeconds?: number
  duration?: number
  onStatus?: (status: string, progress?: number) => void
  signal?: AbortSignal
}

export async function prepareChunks(file: File, opts: PrepareOptions): Promise<AudioChunk[]> {
  const { onStatus, signal } = opts
  const name = baseName(file.name)
  const duration = opts.duration ?? (await probeMedia(file)).duration

  if (opts.mode === 'original') {
    if (file.size > opts.maxBytes) {
      throw new Error(
        tf(
          t(
            'Файл {size} МБ больше лимита сервиса ({max} МБ). Включите «Сжать в MP3» — тогда файл будет сжат и порезан на части автоматически.',
            'The file is {size} MB, over the service limit ({max} MB). Choose “Compress to MP3” and it will be compressed and split automatically.',
          ),
          { size: (file.size / 1024 ** 2).toFixed(1), max: (opts.maxBytes / 1024 ** 2).toFixed(0) },
        ),
      )
    }
    return [{ blob: file, fileName: file.name, mimeType: file.type || 'application/octet-stream', start: 0, end: duration ?? 0 }]
  }

  const mode = opts.mode
  const ext = mode === 'mp3' ? 'mp3' : 'wav'
  const mime = mode === 'mp3' ? 'audio/mpeg' : 'audio/wav'
  const bySize = Math.floor((opts.maxBytes * 0.9) / BYTES_PER_SEC[mode])
  const chunkSec = Math.max(30, Math.min(bySize, opts.maxChunkSeconds ?? Infinity))

  // 1) Try the fast path: WebCodecs via mediabunny.
  try {
    const extracting = tx(t('Извлекаю и сжимаю аудио…', 'Extracting and compressing audio…'))
    onStatus?.(extracting, 0)
    const full = await convertWithMediabunny(file, {
      mode,
      signal,
      onProgress: (p) => onStatus?.(extracting, p),
    })
    const total = duration ?? full.size / BYTES_PER_SEC[mode]
    if (total <= chunkSec * 1.05) {
      return [{ blob: full, fileName: `${name}.${ext}`, mimeType: mime, start: 0, end: total }]
    }
    // Slice the already-compressed audio (cheap: packets are copied, not re-encoded).
    const chunks: AudioChunk[] = []
    const n = chunkCount(total, chunkSec)
    for (let i = 0; i < n; i++) {
      const start = i * chunkSec
      const end = i === n - 1 ? total : start + chunkSec
      onStatus?.(tf(t('Режу на части: {i} из {n}', 'Splitting into parts: {i} of {n}'), { i: i + 1, n }), i / n)
      const blob = await convertWithMediabunny(full, { mode, start, end, signal })
      chunks.push({ blob, fileName: `${name}.part${i + 1}.${ext}`, mimeType: mime, start, end })
    }
    return chunks
  } catch (e) {
    if ((e as Error)?.name === 'AbortError' || signal?.aborted) throw e
    console.warn('mediabunny conversion failed, falling back to Web Audio', e)
  }

  // 2) Fallback: decode with Web Audio API, emit WAV chunks.
  onStatus?.(tx(t('Декодирую аудио (запасной режим)…', 'Decoding audio (fallback mode)…')))
  let samples: Float32Array
  try {
    samples = await decodeToMono16k(file)
  } catch (e) {
    // 3) Браузер не умеет этот кодек — отправим файл как есть, если он влезает в лимит.
    if (file.size <= opts.maxBytes) {
      onStatus?.(tx(t('Браузер не смог декодировать файл — отправляю как есть', 'The browser could not decode the file — sending it as is')))
      return [{ blob: file, fileName: file.name, mimeType: file.type || 'application/octet-stream', start: 0, end: duration ?? 0 }]
    }
    throw new Error(
      tf(
        t(
          'Браузер не может декодировать этот файл ({m}), а целиком он больше лимита сервиса. Попробуйте Chrome/Edge или сконвертируйте в MP3.',
          'The browser cannot decode this file ({m}) and it is larger than the service limit. Try Chrome/Edge or convert it to MP3.',
        ),
        { m: (e as Error).message },
      ),
    )
  }
  const total = samples.length / SAMPLE_RATE
  const wavChunk = Math.max(30, Math.min(Math.floor((opts.maxBytes * 0.9) / BYTES_PER_SEC.wav), opts.maxChunkSeconds ?? Infinity))
  const n = chunkCount(total, wavChunk)
  const chunks: AudioChunk[] = []
  for (let i = 0; i < n; i++) {
    const start = i * wavChunk
    const end = i === n - 1 ? total : start + wavChunk
    const slice = samples.subarray(Math.floor(start * SAMPLE_RATE), Math.floor(end * SAMPLE_RATE))
    chunks.push({
      blob: encodeWav(slice),
      fileName: n > 1 ? `${name}.part${i + 1}.wav` : `${name}.wav`,
      mimeType: 'audio/wav',
      start,
      end,
    })
  }
  return chunks
}
