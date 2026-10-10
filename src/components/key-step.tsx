import { Eye, EyeOff, Gauge, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { store, usageThisMonth, usageToday } from '@/lib/storage'
import { formatDuration } from '@/lib/utils'
import type { LimitInfo, Provider } from '@/providers/types'
import { t, tf, tx } from '@/lib/i18n'
import { L_THIS_MONTH } from '@/providers/langs'

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
        <Label htmlFor="api-key">
          {tx(t('API-ключ', 'API key'))} {provider.name}
        </Label>
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
              aria-label={show ? tx(t('Скрыть ключ', 'Hide key')) : tx(t('Показать ключ', 'Show key'))}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {apiKey && (
            <Button
              variant="outline"
              size="icon"
              aria-label={tx(t('Удалить ключ', 'Delete key'))}
              title={tx(t('Удалить ключ из браузера', 'Delete the key from this browser'))}
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
          {tf(
            t(
              'Ключ хранится только в этом браузере (localStorage) и отправляется напрямую в {v}. Нет ключа?',
              'The key is stored only in this browser (localStorage) and sent directly to {v}. No key yet?',
            ),
            { v: tx(provider.vendor) },
          )}{' '}
          <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" className="font-medium text-foreground underline underline-offset-4">
            {provider.card === 'no' ? tx(t('Получить бесплатно →', 'Get one for free →')) : tx(t('Получить ключ →', 'Get a key →'))}
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
          <Gauge className="size-4" /> {tx(t('Лимиты', 'Limits'))}
        </div>
        {provider.checkLimits ? (
          <Button size="sm" variant="outline" disabled={!apiKey || state.loading} onClick={check}>
            {state.loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {tx(t('Проверить ключ и баланс', 'Check key & balance'))}
          </Button>
        ) : (
          <ButtonLink size="sm" variant="outline" href={provider.keyUrl}>
            {tx(t('Смотреть в кабинете', 'View in dashboard'))}
          </ButtonLink>
        )}
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/60 p-2">
            <div className="text-muted-foreground">{tx(t('Сегодня через BLA-БЛА', 'Today via BLA-БЛА'))}</div>
            <div className="mt-0.5 font-medium">
              {formatDuration(today.seconds)} · {tf(t('{n} файл(ов)', '{n} file(s)'), { n: today.requests })}
            </div>
          </div>
          <div className="rounded-md bg-muted/60 p-2">
            <div className="text-muted-foreground">{tx(L_THIS_MONTH)}</div>
            <div className="mt-0.5 font-medium">
              {formatDuration(month.seconds)} · {tf(t('{n} файл(ов)', '{n} file(s)'), { n: month.requests })}
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
            <li key={tx(l)}>{tx(l)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
