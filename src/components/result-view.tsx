import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Badge, Tabs } from '@/components/ui/misc'
import { exportResult, toTimestampedText } from '@/lib/export'
import { formatDuration } from '@/lib/utils'
import type { TranscriptResult } from '@/providers/types'
import { t, tf, tx } from '@/lib/i18n'

type View = 'text' | 'segments' | 'json'

/** Состояние правок сбрасывается через `key` у родителя. */
export function ResultView({ result, baseName, onEdit }: { result: TranscriptResult; baseName: string; onEdit?: (text: string) => void }) {
  const segs = result.segments ?? []
  const [view, setView] = useState<View>('text')
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState(result.text)

  const speakers = new Set(segs.map((s) => s.speaker).filter(Boolean))
  const shown = view === 'text' ? text : view === 'segments' ? toTimestampedText(segs) : JSON.stringify(result.raw ?? result, null, 2)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  async function copy() {
    await navigator.clipboard.writeText(shown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const current = { ...result, text }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{tf(t('{n} слов', '{n} words'), { n: words })}</Badge>
        <Badge variant="secondary">{tf(t('{n} символов', '{n} characters'), { n: text.length })}</Badge>
        {result.language && <Badge variant="secondary">{tf(t('язык: {l}', 'language: {l}'), { l: result.language })}</Badge>}
        {segs.length > 0 && <Badge variant="secondary">{tf(t('{n} фрагментов', '{n} segments'), { n: segs.length })}</Badge>}
        {speakers.size > 0 && <Badge variant="secondary">{tf(t('{n} спикер(а)', '{n} speaker(s)'), { n: speakers.size })}</Badge>}
        {result.duration != null && <Badge variant="secondary">{formatDuration(result.duration)}</Badge>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={view}
          onValueChange={setView}
          items={[
            { value: 'text', label: tx(t('Текст', 'Text')) },
            ...(segs.length ? [{ value: 'segments' as View, label: tx(t('Таймкоды', 'Timestamps')) }] : []),
            { value: 'json', label: 'JSON' },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? tx(t('Скопировано', 'Copied')) : tx(t('Копировать', 'Copy'))}
          </Button>
          {(['txt', 'md', ...(segs.length ? ['srt', 'vtt'] : []), 'json'] as const).map((f) => (
            <Button key={f} size="sm" variant="outline" onClick={() => exportResult(current, f as 'txt', baseName)}>
              <Download /> {f.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {view === 'text' ? (
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onEdit?.(e.target.value)
          }}
          className="max-h-[60vh] min-h-64 text-[15px] leading-relaxed"
          aria-label={tx(t('Текст транскрибации', 'Transcript text'))}
        />
      ) : (
        <pre className="max-h-[60vh] min-h-64 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {shown}
        </pre>
      )}

      {result.rateLimit && (
        <details className="rounded-md border p-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">{tx(t('Что сервис сообщил о лимитах', 'What the service reported about limits'))}</summary>
          <div className="mt-2 grid gap-1 font-mono">
            {Object.entries(result.rateLimit).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
