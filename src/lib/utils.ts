import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getLang } from '@/lib/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  const [b, kb, mb, gb] = getLang() === 'ru' ? ['Б', 'КБ', 'МБ', 'ГБ'] : ['B', 'KB', 'MB', 'GB']
  if (bytes < 1024) return `${bytes} ${b}`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} ${kb}`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} ${mb}`
  return `${(bytes / 1024 ** 3).toFixed(2)} ${gb}`
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Cancelled', 'AbortError'))
      },
      { once: true },
    )
  })
}
