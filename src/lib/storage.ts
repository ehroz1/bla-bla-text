import type { SettingValues, TranscriptResult } from '@/providers/types'

const PREFIX = 'bbt:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === undefined) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

export const store = {
  getKey: (provider: string) => read<string>(`key:${provider}`, ''),
  setKey: (provider: string, key: string) => write(`key:${provider}`, key || undefined),
  getSettings: (provider: string) => read<SettingValues>(`settings:${provider}`, {}),
  setSettings: (provider: string, s: SettingValues) => write(`settings:${provider}`, s),
  getPrefs: () => read<Prefs>('prefs', defaultPrefs),
  setPrefs: (p: Prefs) => write('prefs', p),
  getUsage: () => read<UsageEntry[]>('usage', []),
  addUsage: (e: UsageEntry) => write('usage', [...read<UsageEntry[]>('usage', []), e].slice(-500)),
  getHistory: () => read<HistoryEntry[]>('history', []),
  addHistory: (e: HistoryEntry) => write('history', [e, ...read<HistoryEntry[]>('history', [])].slice(0, 30)),
  setHistory: (h: HistoryEntry[]) => write('history', h),
  clearAll: () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      /* ignore */
    }
  },
}

export interface Prefs {
  provider: string
  prepare: 'mp3' | 'wav' | 'original'
  corsProxy: string
  useProxyFor: Record<string, boolean>
  theme: 'light' | 'dark' | 'system'
}

export const defaultPrefs: Prefs = {
  provider: 'groq',
  prepare: 'mp3',
  corsProxy: '',
  useProxyFor: {},
  theme: 'system',
}

export interface UsageEntry {
  provider: string
  at: number
  seconds: number
  bytes: number
  ok: boolean
}

export interface HistoryEntry {
  id: string
  at: number
  provider: string
  fileName: string
  duration?: number
  result: TranscriptResult
}

/** Суммарно распознано через сервис за текущий календарный месяц, сек. */
export function usageThisMonth(provider: string): { seconds: number; requests: number } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const list = store.getUsage().filter((u) => u.provider === provider && u.at >= from && u.ok)
  return { seconds: list.reduce((a, u) => a + u.seconds, 0), requests: list.length }
}

export function usageToday(provider: string): { seconds: number; requests: number } {
  const from = new Date().setHours(0, 0, 0, 0)
  const list = store.getUsage().filter((u) => u.provider === provider && u.at >= from && u.ok)
  return { seconds: list.reduce((a, u) => a + u.seconds, 0), requests: list.length }
}
