import { Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/misc'
import type { Provider, SettingValues } from '@/providers/types'

export function defaultSettings(p: Provider): SettingValues {
  return Object.fromEntries(p.settings.map((s) => [s.id, s.default]))
}

export function SettingsStep({
  provider,
  values,
  onChange,
  disabled,
}: {
  provider: Provider
  values: SettingValues
  onChange: (v: SettingValues) => void
  disabled?: boolean
}) {
  if (!provider.settings.length) return <p className="text-sm text-muted-foreground">У этого сервиса нет настроек.</p>
  const set = (id: string, v: string | number | boolean) => onChange({ ...values, [id]: v })
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {provider.settings.map((s) => {
        const id = `set-${provider.id}-${s.id}`
        const v = values[s.id] ?? s.default
        const hint = s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>
        switch (s.kind) {
          case 'select':
            return (
              <div key={s.id} className="grid content-start gap-2">
                <Label htmlFor={id}>{s.label}</Label>
                <NativeSelect id={id} value={String(v)} disabled={disabled} onChange={(e) => set(s.id, e.target.value)}>
                  {s.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
                {hint}
              </div>
            )
          case 'toggle':
            return (
              <div key={s.id} className="flex items-start justify-between gap-3 self-start rounded-lg border p-3">
                <div className="grid gap-1">
                  <Label htmlFor={id}>{s.label}</Label>
                  {hint}
                </div>
                <Switch id={id} checked={Boolean(v)} disabled={disabled} onCheckedChange={(c) => set(s.id, c)} />
              </div>
            )
          case 'number':
            return (
              <div key={s.id} className="grid content-start gap-2">
                <Label htmlFor={id}>{s.label}</Label>
                <Input
                  id={id}
                  type="number"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={Number(v)}
                  disabled={disabled}
                  onChange={(e) => set(s.id, e.target.value === '' ? s.default : Number(e.target.value))}
                />
                {hint}
              </div>
            )
          case 'text':
            return (
              <div key={s.id} className="grid content-start gap-2 sm:col-span-2">
                <Label htmlFor={id}>{s.label}</Label>
                {s.multiline ? (
                  <Textarea id={id} value={String(v)} placeholder={s.placeholder} disabled={disabled} onChange={(e) => set(s.id, e.target.value)} />
                ) : (
                  <Input id={id} value={String(v)} placeholder={s.placeholder} disabled={disabled} onChange={(e) => set(s.id, e.target.value)} />
                )}
                {hint}
              </div>
            )
        }
      })}
    </div>
  )
}
