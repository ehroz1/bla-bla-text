import { Check, CreditCard, ExternalLink, Globe, KeyRound, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { LangMeter } from '@/components/lang-meter'
import { ButtonLink } from '@/components/ui/button'
import { Badge, Tabs } from '@/components/ui/misc'
import { store } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { providers } from '@/providers'
import type { Provider } from '@/providers/types'
import { t, type Text, tx } from '@/lib/i18n'
import { CARD_TEXT } from '@/providers/langs'

type Filter = 'all' | 'ru-en' | 'kk' | 'nocard'

const FILTERS: { value: Filter; label: Text }[] = [
  { value: 'all', label: t('Все', 'All') },
  { value: 'ru-en', label: 'RU + EN' },
  { value: 'kk', label: 'Қазақша' },
  { value: 'nocard', label: t('Без карты', 'No card') },
]

function matches(p: Provider, f: Filter) {
  if (f === 'ru-en') return p.tags.includes('ru-en')
  if (f === 'kk') return p.tags.includes('kk')
  if (f === 'nocard') return p.card === 'no'
  return true
}

export function ProviderPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const list = providers.filter((p) => matches(p, filter))
  return (
    <div className="space-y-3">
      <Tabs
        value={filter}
        onValueChange={setFilter}
        items={FILTERS.map((f) => ({ value: f.value, label: tx(f.label) }))}
        className="w-full sm:w-fit"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {list.map((p) => {
          const active = p.id === value
          const hasKey = !!store.getKey(p.id)
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.id)}
              className={cn(
                'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60',
                active ? 'border-foreground bg-accent/60 ring-1 ring-foreground' : 'hover:bg-accent/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    {p.name}
                    {hasKey && (
                      <span title={tx(t('Ключ сохранён', 'Key saved'))} className="text-success">
                        <KeyRound className="size-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{tx(p.vendor)}</div>
                </div>
                {active && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <div className="line-clamp-2 text-sm text-muted-foreground">{tx(p.tagline)}</div>
              <LangMeter provider={p} />
              <div className="flex flex-wrap gap-1">
                <Badge variant="success">{tx(p.free)}</Badge>
                {p.card !== 'no' && (
                  <Badge variant="outline">
                    {tx(t('карта', 'card'))} {tx(CARD_TEXT[p.card])}
                  </Badge>
                )}
                {p.cors === 'no' && <Badge variant="warning">{tx(t('нужен прокси', 'needs proxy'))}</Badge>}
              </div>
            </button>
          )
        })}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">{tx(t('Нет сервисов под этот фильтр.', 'No services match this filter.'))}</p>}
    </div>
  )
}

export function ProviderDetails({ provider }: { provider: Provider }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed text-muted-foreground">{tx(provider.description)}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{tx(t('Бесплатно', 'Free'))}</div>
          <div className="font-medium">{tx(provider.free)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCard className="size-3.5" /> {tx(t('Банковская карта', 'Bank card'))}: {tx(CARD_TEXT[provider.card])}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{tx(t('После лимита', 'After the free tier'))}</div>
          <div>{tx(provider.pricing)}</div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{tx(t('Лимиты', 'Limits'))}</div>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {provider.limits.map((l) => (
            <li key={tx(l)}>{tx(l)}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <KeyRound className="size-4" /> {tx(t('Как получить ключ', 'How to get a key'))}
        </div>
        <ol className="list-decimal space-y-1.5 pl-5">
          {provider.keySteps.map((s) => (
            <li key={tx(s)} className="leading-relaxed">
              <Linkify text={tx(s)} />
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={provider.keyUrl} size="sm">
            <KeyRound /> {tx(t('Открыть страницу ключей', 'Open the keys page'))}
          </ButtonLink>
          <ButtonLink href={provider.signupUrl} size="sm" variant="outline">
            <ExternalLink /> {tx(t('Регистрация', 'Sign up'))}
          </ButtonLink>
          <ButtonLink href={provider.docsUrl} size="sm" variant="ghost">
            <Globe /> {tx(t('Документация', 'Docs'))}
          </ButtonLink>
        </div>
      </div>

      {provider.cors !== 'yes' && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            {provider.cors === 'no'
              ? tx(
                  t(
                    'Этот сервис не разрешает запросы прямо из браузера. Нужен свой CORS-прокси (бесплатный Cloudflare Worker, инструкция — во вкладке «Настройки»).',
                    'This service does not allow requests straight from the browser. You need your own CORS proxy (a free Cloudflare Worker, instructions in the Settings tab).',
                  ),
                )
              : tx(
                  t(
                    'Не удалось точно проверить, пускает ли сервис запросы из браузера. Если увидите ошибку сети — включите CORS-прокси во вкладке «Настройки».',
                    'We could not verify whether this service accepts browser requests. If you see a network error, enable the CORS proxy in the Settings tab.',
                  ),
                )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Превращает URL в тексте шагов в ссылки. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)»,]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="font-medium underline underline-offset-4 break-all">
            {part.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
