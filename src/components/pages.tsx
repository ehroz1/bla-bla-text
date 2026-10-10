import { CheckCircle2, CircleDashed, ExternalLink, History, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { LangMeter } from '@/components/lang-meter'
import { LimitsPanel } from '@/components/key-step'
import { ResultView } from '@/components/result-view'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Badge, Switch } from '@/components/ui/misc'
import { type HistoryEntry, type Prefs, store } from '@/lib/storage'
import { formatDuration } from '@/lib/utils'
import { providerById, providers } from '@/providers'
import { makeFetch } from '@/providers/http'
import { locale, t, tf, tx } from '@/lib/i18n'
import { CARD_TEXT } from '@/providers/langs'

export function LimitsPage({ prefs }: { prefs: Prefs }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{tx(t('Сервисы и лимиты', 'Services & limits'))}</h2>
        <p className="text-sm text-muted-foreground">
          {tx(
            t(
              'Бесплатные тарифы, ограничения и ваш расход. Кнопка «Проверить» спрашивает остаток у самого сервиса — там, где API это позволяет. Счётчик «через BLA-БЛА» ведётся локально в браузере.',
              'Free tiers, limits and your usage. The “Check” button asks the service itself for the remaining balance, where its API allows it. The “via BLA-БЛА” counter is kept locally in your browser.',
            ),
          )}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((p) => {
          const key = store.getKey(p.id)
          const fetchFn = makeFetch(prefs.useProxyFor[p.id] ? prefs.corsProxy : undefined)
          return (
            <Card key={p.id} className="gap-4">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{tx(p.vendor)}</CardDescription>
                  </div>
                  {key ? (
                    <Badge variant="success">
                      <CheckCircle2 /> {tx(t('ключ сохранён', 'key saved'))}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <CircleDashed /> {tx(t('нет ключа', 'no key'))}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <LangMeter provider={p} />
                <div className="flex flex-wrap gap-1">
                  <Badge variant="success">{tx(p.free)}</Badge>
                  <Badge variant="outline">
                    {tx(t('карта', 'card'))}: {tx(CARD_TEXT[p.card])}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{tx(p.pricing)}</div>
                <LimitsPanel provider={p} apiKey={key} fetchFn={fetchFn} />
                <ButtonLink href={p.keyUrl} size="sm" variant="ghost">
                  <ExternalLink /> {tx(t('Кабинет и ключи', 'Dashboard & keys'))}
                </ButtonLink>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function HistoryPage() {
  const [list, setList] = useState<HistoryEntry[]>(() => store.getHistory())
  const [open, setOpen] = useState<string | null>(null)
  if (!list.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
        <History className="size-6" />
        <div>
          {tx(
            t(
              'История пуста. Последние 30 расшифровок сохраняются здесь, в вашем браузере.',
              'History is empty. Your last 30 transcripts are saved here, in your browser.',
            ),
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{tx(t('История', 'History'))}</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            store.setHistory([])
            setList([])
          }}
        >
          <Trash2 /> {tx(t('Очистить', 'Clear'))}
        </Button>
      </div>
      {list.map((h) => (
        <Card key={h.id} className="gap-3 py-4">
          <CardHeader className="px-4">
            <div className="flex items-start justify-between gap-2">
              <button type="button" className="min-w-0 text-left" onClick={() => setOpen(open === h.id ? null : h.id)}>
                <CardTitle className="truncate">{h.fileName}</CardTitle>
                <CardDescription className="mt-1">
                  {new Date(h.at).toLocaleString(locale())} · {providerById(h.provider)?.name ?? h.provider} ·{' '}
                  {formatDuration(h.duration)}
                </CardDescription>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tx(t('Удалить', 'Delete'))}
                onClick={() => {
                  const next = list.filter((x) => x.id !== h.id)
                  store.setHistory(next)
                  setList(next)
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4">
            {open === h.id ? (
              <ResultView key={h.id} result={h.result} baseName={h.fileName.replace(/\.[^.]+$/, '')} />
            ) : (
              <button type="button" className="line-clamp-2 text-left text-sm text-muted-foreground" onClick={() => setOpen(h.id)}>
                {h.result.text}
              </button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SettingsPage({ prefs, onPrefs }: { prefs: Prefs; onPrefs: (p: Prefs) => void }) {
  const [test, setTest] = useState<string>('')
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{tx(t('Настройки', 'Settings'))}</h2>
      <Card>
        <CardHeader>
          <CardTitle>{tx(t('CORS-прокси', 'CORS proxy'))}</CardTitle>
          <CardDescription>
            {tx(
              t(
                'Некоторые сервисы (Deepgram, Yandex SpeechKit и др.) не принимают запросы напрямую из браузера. Для них нужен свой маленький прокси — бесплатный Cloudflare Worker разворачивается за 5 минут.',
                'Some services (Deepgram, Yandex SpeechKit and others) refuse requests made directly from a browser. They need your own small proxy — a free Cloudflare Worker takes about 5 minutes to deploy.',
              ),
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              {tx(t('Зайдите на', 'Go to'))}{' '}
              <a className="underline underline-offset-4" href="https://dash.cloudflare.com/sign-up/workers-and-pages" target="_blank" rel="noreferrer">
                dash.cloudflare.com
              </a>{' '}
              {tx(t('(бесплатно, без карты)', '(free, no card)'))} → Workers &amp; Pages → Create → Create Worker → Deploy.
            </li>
            <li>
              {tx(t('Нажмите «Edit code», вставьте код из', 'Click “Edit code” and paste the code from'))}{' '}
              <a
                className="underline underline-offset-4"
                href="https://github.com/ehroz1/bla-bla-text/blob/main/proxy/cloudflare-worker.js"
                target="_blank"
                rel="noreferrer"
              >
                proxy/cloudflare-worker.js
              </a>{' '}
              → Deploy.
            </li>
            <li>
              {tx(
                t(
                  'Скопируйте адрес воркера (https://…workers.dev) в поле ниже и включите прокси для нужных сервисов.',
                  'Copy the worker URL (https://…workers.dev) into the field below and enable the proxy for the services that need it.',
                ),
              )}
            </li>
          </ol>
          <div className="grid gap-2">
            <Label htmlFor="proxy">{tx(t('Адрес прокси', 'Proxy URL'))}</Label>
            <div className="flex gap-2">
              <Input
                id="proxy"
                placeholder="https://bla-proxy.username.workers.dev"
                value={prefs.corsProxy}
                onChange={(e) => onPrefs({ ...prefs, corsProxy: e.target.value.trim() })}
              />
              <Button
                variant="outline"
                disabled={!prefs.corsProxy}
                onClick={async () => {
                  setTest(tx(t('Проверяю…', 'Checking…')))
                  try {
                    const r = await fetch(prefs.corsProxy.replace(/\/+$/, '') + '/https://api.groq.com/openai/v1/models')
                    setTest(
                      r.status === 401
                        ? tx(t('Прокси работает ✓ (сервис ответил 401 без ключа — это нормально)', 'Proxy works ✓ (the service answered 401 without a key — that is expected)'))
                        : tf(t('Прокси ответил: {s}', 'The proxy answered: {s}'), { s: r.status }),
                    )
                  } catch (e) {
                    setTest(tx(t('Не удалось достучаться до прокси: ', 'Could not reach the proxy: ')) + (e as Error).message)
                  }
                }}
              >
                {tx(t('Проверить', 'Check'))}
              </Button>
            </div>
            {test && <p className="text-xs text-muted-foreground">{test}</p>}
            <p className="text-xs text-muted-foreground">
              {tx(t('Используйте только свой прокси: через него проходит ваш API-ключ.', 'Only use your own proxy: your API key passes through it.'))}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                  {p.name}{' '}
                  {p.cors === 'no' && (
                    <Badge variant="warning" className="ml-1">
                      {tx(t('нужен', 'needed'))}
                    </Badge>
                  )}
                </span>
                <Switch
                  checked={!!prefs.useProxyFor[p.id]}
                  disabled={!prefs.corsProxy}
                  onCheckedChange={(c) => onPrefs({ ...prefs, useProxyFor: { ...prefs.useProxyFor, [p.id]: c } })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tx(t('Данные в браузере', 'Data in your browser'))}</CardTitle>
          <CardDescription>
            {tx(
              t(
                'Ключи, настройки, история и счётчики хранятся только в localStorage этого браузера. Сервер у BLA-БЛА отсутствует.',
                'Keys, settings, history and counters are stored only in this browser’s localStorage. BLA-БЛА has no server.',
              ),
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(tx(t('Удалить все ключи, историю и настройки из этого браузера?', 'Delete all keys, history and settings from this browser?')))) {
                store.clearAll()
                location.reload()
              }
            }}
          >
            <Trash2 /> {tx(t('Стереть всё', 'Erase everything'))}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
