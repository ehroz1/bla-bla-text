import { useId } from 'react'
import { cn } from '@/lib/utils'

// BLA / БЛА — кистевой логотип, перерисованный в SVG.
// Штрихи + фильтр «рваного» края и мелких проплешин, как у оттиска кистью.
const LOGO_STROKES = [
  // B
  'M58 46 L52 150',
  'M56 50 C 100 42, 124 60, 108 80 C 98 92, 80 97, 58 98',
  'M58 98 C 106 96, 130 112, 116 134 C 104 148, 80 151, 52 150',
  // L
  'M148 60 L144 148 L186 146',
  // A
  'M206 150 L214 92 C 218 60, 226 50, 238 50 C 252 50, 256 62, 256 92 L260 150',
  'M212 116 L254 114',
  // Б
  'M52 174 L54 274',
  'M50 176 L112 174',
  'M54 216 C 102 212, 122 230, 114 254 C 106 270, 80 275, 54 274',
  // Л
  'M134 276 C 140 236, 148 200, 156 176 L176 176 C 180 210, 184 244, 186 276',
  // А
  'M208 276 L216 218 C 220 188, 228 176, 240 176 C 254 176, 258 188, 258 218 L262 276',
  'M214 240 L256 238',
]

export function Logo({ className, title = 'BLA-БЛА' }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="20 20 270 280" role="img" aria-label={title} className={cn('text-foreground', className)}>
      <defs>
        <filter id={`rough-${id}`} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="7" result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale="6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -24 0 0 0 18.5" result="holes" />
          <feComposite in="d" in2="holes" operator="in" />
        </filter>
      </defs>
      <g
        filter={`url(#rough-${id})`}
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="square"
        strokeLinejoin="round"
      >
        {LOGO_STROKES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  )
}
