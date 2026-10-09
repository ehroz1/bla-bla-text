import { Eye, EyeOff, Gauge, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { store, usageThisMonth, usageToday } from '@/lib/storage'
import { formatDuration } from '@/lib/utils'
import type { LimitInfo, Provider } from '@/providers/types'

export function KeyStep({
  provider,
  apiKey,
  onKey,
  fetchFn,
  disabled,
}: {
  provider: Provider
  apiKey: string
  onKey: (k: string) => void
  fetchFn: typeof fetch
  disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="api-key">API-ключ {provider.name}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.keyPlaceholder}
              value={apiKey}
              disabled={disabled}
              onChange={(e) => {
                const k = e.target.value.trim()
                onKey(k)
                store.setKey(provider.id, k)
              }}
              className="pr-9 font-mono"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? 'Скрыть ключ' : 'Показать ключ'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {apiKey && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Удалить ключ"
              title="Удалить ключ из браузера"
              onClick={() => {
                onKey('')
                store.setKey(provider.id, '')
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Ключ хранится только в этом браузере (localStorage) и отправляется напрямую в {provider.vendor}. Нет ключа?{' '}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" className="font-medium text-foreground underline underline-offset-4">
            Получить бесплатно →
          </a>
        </p>
      </div>
      <LimitsPanel provider={provider} apiKey={apiKey} fetchFn={fetchFn} />
    </div>
  )
}

export function LimitsPanel({
  provider,
  apiKey,
  fetchFn,
  compact,
}: {
  provider: Provider
  apiKey: string
  fetchFn: typeof fetch
  compact?: boolean
}) {
  const [state, setState] = useState<{ loading?: boolean; info?: LimitInfo; error?: string }>({})
  const month = usageThisMonth(provider.id)
  const today = usageToday(provider.id)

  async function check() {
    setState({ loading: true })
    const ctl = new AbortController()
    try {
      const info = await provider.checkLimits!({ apiKey, fetch: fetchFn, signal: ctl.signal })
      setState({ info })
    } catch (e) {
      setState({ error: (e as Error).message })
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Gauge className="size-4" /> Лимиты
        </div>
        {provider.checkLimits ? (
          <Button size="sm" variant="outline" disabled={!apiKey || state.loading} onClick={check}>
            {state.loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Проверить ключ и баланс
          </Button>
        ) : (
          <ButtonLink size="sm" variant="outline" href={provider.keyUrl}>
            Смотреть в кабинете
          </ButtonLink>
        )}
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/60 p-2">
            <div className="text-muted-foreground">Сегодня через BLA-БЛА</div>
            <div className="mt-0.5 font-medium">
              {formatDuration(today.seconds)} · {today.requests} файл(ов)
            </div>
          </div>
          <div className="rounded-md bg-muted/60 p-2">
            <div className="text-muted-foreground">В этом месяце</div>
            <div className="mt-0.5 font-medium">
              {formatDuration(month.seconds)} · {month.requests} файл(ов)
            </div>
          </div>
        </div>
      )}

      {state.error && <div className="text-xs text-destructive">{state.error}</div>}
      {state.info && (
        <div className="space-y-2">
          {state.info.items.map((it) => (
            <div key={it.label} className="space-y-1">
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{it.label}</span>
                <span className="font-medium tabular-nums">{it.value}</span>
              </div>
              {it.progress != null && <Progress value={it.progress * 100} className="h-1.5" />}
            </div>
          ))}
          {state.info.note && <p className="text-xs text-muted-foreground">{state.info.note}</p>}
        </div>
      )}

      {!compact && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {provider.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
