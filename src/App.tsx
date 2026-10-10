import { AudioLines, Check, History, Info, Loader2, Monitor, Moon, Play, Settings, Square, Sun, Gauge } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AboutPage } from '@/components/about-page'
import { FileStep } from '@/components/file-step'
import { KeyStep } from '@/components/key-step'
import { Logo } from '@/components/logo'
import { HistoryPage, LimitsPage, SettingsPage } from '@/components/pages'
import { ProviderDetails, ProviderPicker } from '@/components/provider-step'
import { ResultView } from '@/components/result-view'
import { defaultSettings, SettingsStep } from '@/components/settings-step'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle, Badge, Progress, Switch } from '@/components/ui/misc'
import { type MediaInfo, type PrepareMode, probeMedia } from '@/lib/audio'
import { runTranscription } from '@/lib/run'
import { type Prefs, store } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { providerById, providers } from '@/providers'
import { makeFetch } from '@/providers/http'
import type { SettingValues, TranscriptResult } from '@/providers/types'
import { detectLang, type L, type Lang, setLang, t, tf, tx } from '@/lib/i18n'

type Page = 'transcribe' | 'limits' | 'history' | 'settings' | 'about'

const NAV: { id: Page; label: L; icon: React.ReactNode }[] = [
  { id: 'transcribe', label: t('Транскрибация', 'Transcribe'), icon: <AudioLines /> },
  { id: 'limits', label: t('Сервисы и лимиты', 'Services & limits'), icon: <Gauge /> },
  { id: 'history', label: t('История', 'History'), icon: <History /> },
  { id: 'settings', label: t('Настройки', 'Settings'), icon: <Settings /> },
  { id: 'about', label: t('О проекте', 'About'), icon: <Info /> },
]

function useTheme(theme: Prefs['theme']) {
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

function Step({
  n,
  title,
  description,
  done,
  children,
  aside,
}: {
  n: number
  title: string
  description?: React.ReactNode
  done?: boolean
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                done ? 'border-foreground bg-foreground text-background' : 'bg-background',
              )}
            >
              {done ? <Check className="size-4" /> : n}
            </span>
            <div className="grid gap-1.5 pt-1">
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(() => (location.hash.slice(1) as Page) || 'transcribe')
  const [prefs, setPrefsState] = useState<Prefs>(() => ({ ...store.getPrefs() }))
  const setPrefs = (p: Prefs) => {
    setPrefsState(p)
    store.setPrefs(p)
  }
  useTheme(prefs.theme)
  // Язык выставляется до рендера дочерних компонентов: они читают его через tx().
  const lang: Lang = prefs.lang ?? detectLang()
  setLang(lang)
  useEffect(() => {
    document.title = tx(t('BLA-БЛА — транскрибация аудио и видео', 'BLA-БЛА — audio & video transcription'))
  }, [lang])
  useEffect(() => {
    const onHash = () => setPage((location.hash.slice(1) as Page) || 'transcribe')
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  const go = (p: Page) => {
    location.hash = p === 'transcribe' ? '' : p
    setPage(p)
    scrollTo({ top: 0 })
  }

  const provider = providerById(prefs.provider) ?? providers[0]
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [apiKey, setApiKey] = useState(() => store.getKey(provider.id))
  const [settings, setSettings] = useState<SettingValues>(() => ({ ...defaultSettings(provider), ...store.getSettings(provider.id) }))
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<{ text: string; progress?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranscriptResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<File | null>(null)
  const [runId, setRunId] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  const selectProvider = (id: string) => {
    const p = providerById(id) ?? providers[0]
    setPrefs({ ...prefs, provider: p.id })
    setApiKey(store.getKey(p.id))
    setSettings({ ...defaultSettings(p), ...store.getSettings(p.id) })
  }

  const selectFile = (f: File | null) => {
    setFile(f)
    setInfo(null)
    setResult(null)
    setError(null)
    setStatus(null)
    fileRef.current = f
    if (f) probeMedia(f).then((i) => fileRef.current === f && setInfo(i))
  }

  const useProxy = !!prefs.corsProxy && !!prefs.useProxyFor[provider.id]
  const fetchFn = useMemo(() => makeFetch(useProxy ? prefs.corsProxy : undefined), [useProxy, prefs.corsProxy])

  async function start() {
    if (!file || !apiKey) return
    const ctl = new AbortController()
    abortRef.current = ctl
    setRunning(true)
    setError(null)
    setResult(null)
    setStatus({ text: tx(t('Готовлю файл…', 'Preparing the file…')), progress: 0 })
    const startedAt = Date.now()
    try {
      const { result } = await runTranscription({
        file,
        duration: info?.duration,
        provider,
        apiKey,
        settings,
        prepare: prefs.prepare,
        fetch: fetchFn,
        signal: ctl.signal,
        onStatus: (text, progress) => setStatus((s) => ({ text, progress: progress ?? s?.progress })),
      })
      setResult(result)
      setRunId((n) => n + 1)
      const seconds = info?.duration ?? result.duration ?? 0
      store.addUsage({ provider: provider.id, at: Date.now(), seconds, bytes: file.size, ok: true })
      store.addHistory({
        id: `${startedAt}`,
        at: startedAt,
        provider: provider.id,
        fileName: file.name,
        duration: seconds,
        result: { ...result, raw: undefined },
      })
      setStatus({ text: tf(t('Готово за {s} с', 'Done in {s} s'), { s: Math.round((Date.now() - startedAt) / 1000) }), progress: 1 })
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError' || ctl.signal.aborted) {
        setStatus(null)
        setError(tx(t('Остановлено', 'Stopped')))
      } else {
        console.error(e)
        setError(err.message || String(e))
        setStatus(null)
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const themeIcon = prefs.theme === 'dark' ? <Moon /> : prefs.theme === 'light' ? <Sun /> : <Monitor />
  const nextTheme: Prefs['theme'] = prefs.theme === 'system' ? 'light' : prefs.theme === 'light' ? 'dark' : 'system'

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <button type="button" onClick={() => go('transcribe')} className="flex items-center gap-2.5">
            <Logo className="size-9" />
            <div className="hidden text-left leading-tight sm:block">
              <div className="font-bold tracking-tight">BLA-БЛА</div>
              <div className="text-[11px] text-muted-foreground">{tx(t('аудио и видео → текст', 'audio & video → text'))}</div>
            </div>
          </button>
          <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
            {NAV.map((n) => (
              <Button
                key={n.id}
                size="sm"
                variant="ghost"
                onClick={() => go(n.id)}
                className={cn(page === n.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
                title={tx(n.label)}
              >
                {n.icon}
                <span className="hidden md:inline">{tx(n.label)}</span>
              </Button>
            ))}
          </nav>
          <Button
            size="sm"
            variant="ghost"
            className="px-2 font-mono text-xs font-semibold"
            onClick={() => setPrefs({ ...prefs, lang: lang === 'ru' ? 'en' : 'ru' })}
            title={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
            aria-label={lang === 'ru' ? 'Switch to English' : 'Переключить на русский'}
          >
            {lang === 'ru' ? 'EN' : 'RU'}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setPrefs({ ...prefs, theme: nextTheme })}
            title={tf(t('Тема: {v}', 'Theme: {v}'), {
              v: tx(
                prefs.theme === 'system'
                  ? t('как в системе', 'system')
                  : prefs.theme === 'dark'
                    ? t('тёмная', 'dark')
                    : t('светлая', 'light'),
              ),
            })}
          >
            {themeIcon}
          </Button>
          <ButtonLink href="https://github.com/ehroz1/bla-bla-text" size="icon-sm" variant="ghost" title="GitHub">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
            </svg>
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {page === 'transcribe' && (
          <div className="space-y-6">
            <section className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {tx(t('Транскрибация аудио и видео', 'Audio & video transcription'))}
              </h1>
              <p className="max-w-3xl text-muted-foreground">
                {tx(
                  t(
                    'Загрузите файл, выберите сервис распознавания речи, вставьте свой бесплатный API-ключ — и получите текст с таймкодами. Русский, английский вперемешку и казахский. Всё работает в браузере, без нашего сервера.',
                    'Upload a file, pick a speech-to-text service, paste your own free API key — and get text with timestamps. Russian, mixed Russian + English, and Kazakh. Everything runs in your browser, with no server of ours.',
                  ),
                )}
              </p>
            </section>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
              <div className="space-y-6">
                <Step
                  n={1}
                  title={tx(t('Файл', 'File'))}
                  description={tx(t('Любое аудио или видео — звук извлечём сами.', 'Any audio or video — we extract the sound for you.'))}
                  done={!!file}
                >
                  <FileStep
                    file={file}
                    info={info}
                    onFile={selectFile}
                    prepare={prefs.prepare}
                    onPrepare={(m: PrepareMode) => setPrefs({ ...prefs, prepare: m })}
                    disabled={running}
                  />
                </Step>

                <Step
                  n={2}
                  title={tx(t('Сервис', 'Service'))}
                  description={tx(t('Точки — качество распознавания по языкам.', 'Dots show recognition quality per language.'))}
                  done
                >
                  <ProviderPicker value={provider.id} onChange={selectProvider} disabled={running} />
                  <div className="mt-5 border-t pt-5 lg:hidden">
                    <div className="mb-3 font-medium">{provider.name}</div>
                    <ProviderDetails provider={provider} />
                  </div>
                </Step>

                <Step
                  n={3}
                  title={tx(t('API-ключ', 'API key'))}
                  description={tx(t('Сохраняется в этом браузере — вводить второй раз не нужно.', 'Saved in this browser — no need to enter it again.'))}
                  done={!!apiKey}
                >
                  <KeyStep provider={provider} apiKey={apiKey} onKey={setApiKey} fetchFn={fetchFn} disabled={running} />
                </Step>

                <Step
                  n={4}
                  title={tx(t('Настройки', 'Settings'))}
                  description={tx(t('Язык, модель, спикеры, подсказки.', 'Language, model, speakers, hints.'))}
                  aside={
                    prefs.corsProxy ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {tx(t('прокси', 'proxy'))}
                        <Switch
                          checked={useProxy}
                          onCheckedChange={(c) => setPrefs({ ...prefs, useProxyFor: { ...prefs.useProxyFor, [provider.id]: c } })}
                        />
                      </label>
                    ) : undefined
                  }
                >
                  <SettingsStep
                    provider={provider}
                    values={settings}
                    disabled={running}
                    onChange={(v) => {
                      setSettings(v)
                      store.setSettings(provider.id, v)
                    }}
                  />
                </Step>

                <Card className="gap-4">
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {running ? (
                        <Button size="lg" variant="outline" onClick={() => abortRef.current?.abort()}>
                          <Square /> {tx(t('Остановить', 'Stop'))}
                        </Button>
                      ) : (
                        <Button size="lg" onClick={start} disabled={!file || !apiKey || (info != null && !info.hasAudio)}>
                          <Play /> {tf(t('Распознать через {name}', 'Transcribe with {name}'), { name: provider.name })}
                        </Button>
                      )}
                      {!file && <span className="text-sm text-muted-foreground">{tx(t('Добавьте файл', 'Add a file'))}</span>}
                      {file && !apiKey && <span className="text-sm text-muted-foreground">{tx(t('Вставьте API-ключ', 'Paste an API key'))}</span>}
                    </div>
                    {status && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          {running && <Loader2 className="size-4 animate-spin" />}
                          {status.text}
                        </div>
                        <Progress value={(status.progress ?? 0) * 100} />
                      </div>
                    )}
                    {error && (
                      <Alert variant="destructive">
                        <AlertTitle>{tx(t('Не получилось', 'Something went wrong'))}</AlertTitle>
                        <AlertDescription>
                          <p className="break-words">{error}</p>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              <aside className="hidden space-y-6 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:rounded-xl">
                <Card className="gap-4">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <CardDescription>{tx(provider.vendor)}</CardDescription>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {provider.tags.includes('ru-en') && <Badge variant="secondary">RU+EN</Badge>}
                        {provider.tags.includes('kk') && <Badge variant="secondary">KZ</Badge>}
                        {provider.tags.includes('diarization') && <Badge variant="secondary">{tx(t('спикеры', 'speakers'))}</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ProviderDetails provider={provider} />
                  </CardContent>
                </Card>
              </aside>
            </div>

            {result && (
              <div ref={resultRef} className="scroll-mt-20">
                <Card className="gap-4">
                  <CardHeader>
                    <CardTitle className="text-lg">{tx(t('Результат', 'Result'))}</CardTitle>
                    <CardDescription>
                      {file?.name} · {provider.name}.{' '}
                      {tx(t('Текст можно поправить прямо здесь перед скачиванием.', 'You can edit the text right here before downloading.'))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResultView key={runId} result={result} baseName={(file?.name ?? 'transcript').replace(/\.[^.]+$/, '')} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
        {page === 'limits' && <LimitsPage prefs={prefs} />}
        {page === 'history' && <HistoryPage />}
        {page === 'settings' && <SettingsPage prefs={prefs} onPrefs={setPrefs} />}
        {page === 'about' && <AboutPage />}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        BLA-БЛА ·{' '}
        {tx(t('ключи и файлы не покидают ваш браузер, кроме запроса к выбранному сервису', 'keys and files never leave your browser except for the request to the service you choose'))}
      </footer>
    </div>
  )
}
