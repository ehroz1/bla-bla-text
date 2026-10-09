import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`
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
    if (signal?.aborted) return reject(new DOMException('Отменено', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Отменено', 'AbortError'))
      },
      { once: true },
    )
  })
}
