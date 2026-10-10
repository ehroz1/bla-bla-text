import type { Level, Provider } from '@/providers/types'
import { cn } from '@/lib/utils'
import { type L, t, tx } from '@/lib/i18n'

const LABEL: Record<Level, L> = {
  0: t('нет', 'none'),
  1: t('слабо', 'weak'),
  2: t('хорошо', 'good'),
  3: t('отлично', 'excellent'),
}

function Dots({ level }: { level: Level }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn('size-1.5 rounded-full', i <= level ? (level === 1 ? 'bg-warning' : 'bg-foreground') : 'bg-muted-foreground/25')}
        />
      ))}
    </span>
  )
}

export function LangMeter({ provider, className }: { provider: Provider; className?: string }) {
  const rows: [string, Level][] = [
    ['RU', provider.langs.ru],
    ['EN', provider.langs.en],
    ['RU+EN', provider.langs.mix],
    ['KZ', provider.langs.kk],
  ]
  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      {rows.map(([name, level]) => (
        <span key={name} className="inline-flex items-center gap-1.5" title={`${name}: ${tx(LABEL[level])}`}>
          <span className="font-medium">{name}</span>
          <Dots level={level} />
        </span>
      ))}
    </div>
  )
}
