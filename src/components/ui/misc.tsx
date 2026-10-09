import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        success: 'border-transparent bg-success/15 text-success',
        warning: 'border-transparent bg-warning/15 text-warning',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  id,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  className?: string
  id?: string
  disabled?: boolean
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input dark:bg-input/80',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-full ring-0 transition-transform',
          checked
            ? 'translate-x-[calc(100%-2px)] bg-background dark:bg-primary-foreground'
            : 'translate-x-0 bg-background dark:bg-foreground',
        )}
      />
    </button>
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}>
      <div
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
      />
    </div>
  )
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full shrink-0 bg-border', className)} />
}

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'bg-card text-destructive [&>div]:text-destructive/90',
        warning: 'bg-card text-warning [&>div]:text-foreground/80',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('col-start-2 min-h-4 font-medium tracking-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
}

export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: {
  value: T
  onValueChange: (v: T) => void
  items: { value: T; label: React.ReactNode }[]
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground', className)}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onValueChange(it.value)}
          className={cn(
            "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&_svg:not([class*='size-'])]:size-4",
            value === it.value
              ? 'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30'
              : 'text-foreground/60 hover:text-foreground dark:text-muted-foreground',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-mono text-xs font-medium text-muted-foreground select-none',
        className,
      )}
      {...props}
    />
  )
}
