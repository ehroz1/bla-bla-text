import { Check, CreditCard, ExternalLink, Globe, KeyRound, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { LangMeter } from '@/components/lang-meter'
import { ButtonLink } from '@/components/ui/button'
import { Badge, Tabs } from '@/components/ui/misc'
import { store } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { providers } from '@/providers'
import type { Provider } from '@/providers/types'

type Filter = 'all' | 'ru-en' | 'kk' | 'nocard'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'ru-en', label: 'RU + EN' },
  { value: 'kk', label: 'Қазақша' },
  { value: 'nocard', label: 'Без карты' },
]

function matches(p: Provider, f: Filter) {
  if (f === 'ru-en') return p.tags.includes('ru-en')
  if (f === 'kk') return p.tags.includes('kk')
  if (f === 'nocard') return p.card === 'не нужна'
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
      <Tabs value={filter} onValueChange={setFilter} items={FILTERS} className="w-full sm:w-fit" />
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
                      <span title="Ключ сохранён" className="text-success">
                        <KeyRound className="size-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.vendor}</div>
                </div>
                {active && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <div className="line-clamp-2 text-sm text-muted-foreground">{p.tagline}</div>
              <LangMeter provider={p} />
              <div className="flex flex-wrap gap-1">
                <Badge variant="success">{p.free}</Badge>
                {p.card !== 'не нужна' && <Badge variant="outline">карта {p.card}</Badge>}
                {p.cors === 'no' && <Badge variant="warning">нужен прокси</Badge>}
              </div>
            </button>
          )
        })}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Нет сервисов под этот фильтр.</p>}
    </div>
  )
}

export function ProviderDetails({ provider }: { provider: Provider }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed text-muted-foreground">{provider.description}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Бесплатно</div>
          <div className="font-medium">{provider.free}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCard className="size-3.5" /> Банковская карта: {provider.card}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">После лимита</div>
          <div>{provider.pricing}</div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Лимиты</div>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {provider.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="mb-2 flex items-center gap-2 font-medium">
          <KeyRound className="size-4" /> Как получить ключ
        </div>
        <ol className="list-decimal space-y-1.5 pl-5">
          {provider.keySteps.map((s) => (
            <li key={s} className="leading-relaxed">
              <Linkify text={s} />
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={provider.keyUrl} size="sm">
            <KeyRound /> Открыть страницу ключей
          </ButtonLink>
          <ButtonLink href={provider.signupUrl} size="sm" variant="outline">
            <ExternalLink /> Регистрация
          </ButtonLink>
          <ButtonLink href={provider.docsUrl} size="sm" variant="ghost">
            <Globe /> Документация
          </ButtonLink>
        </div>
      </div>

      {provider.cors !== 'yes' && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            {provider.cors === 'no'
              ? 'Этот сервис не разрешает запросы прямо из браузера. Нужен свой CORS-прокси (бесплатный Cloudflare Worker, инструкция — во вкладке «Настройки»).'
              : 'Не удалось точно проверить, пускает ли сервис запросы из браузера. Если увидите ошибку сети — включите CORS-прокси во вкладке «Настройки».'}
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
