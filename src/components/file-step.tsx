import { FileAudio, FileVideo, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/misc'
import type { MediaInfo, PrepareMode } from '@/lib/audio'
import { cn, formatBytes, formatDuration } from '@/lib/utils'
import { t, tx } from '@/lib/i18n'

export function FileStep({
  file,
  info,
  onFile,
  prepare,
  onPrepare,
  disabled,
}: {
  file: File | null
  info: MediaInfo | null
  onFile: (f: File | null) => void
  prepare: PrepareMode
  onPrepare: (m: PrepareMode) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  const isVideo = info?.hasVideo || file?.type.startsWith('video/')

  if (!file) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const f = e.dataTransfer.files?.[0]
          if (f) onFile(f)
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          drag ? 'border-foreground/50 bg-accent' : 'border-border hover:border-foreground/30 hover:bg-accent/50',
        )}
      >
        <div className="flex size-11 items-center justify-center rounded-full border bg-background shadow-xs">
          <Upload className="size-5" />
        </div>
        <div>
          <div className="font-medium">{tx(t('Перетащите аудио или видео сюда', 'Drop audio or video here'))}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {tx(t('или нажмите, чтобы выбрать', 'or click to choose'))} · mp3, m4a, wav, ogg, opus, flac, mp4, mov, webm, mkv…
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,.mkv,.opus,.m4a,.flac,.amr,.3gp,.aac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
          {isVideo ? <FileVideo className="size-5" /> : <FileAudio className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium" title={file.name}>
            {file.name}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">{formatBytes(file.size)}</Badge>
            <Badge variant="secondary">{info ? formatDuration(info.duration) : tx(t('читаю…', 'reading…'))}</Badge>
            {isVideo && <Badge variant="secondary">{tx(t('видео → возьмём только звук', 'video → audio track only'))}</Badge>}
            {info?.audioCodec && <Badge variant="outline">{info.audioCodec}</Badge>}
            {info && !info.hasAudio && <Badge variant="destructive">{tx(t('нет звуковой дорожки', 'no audio track'))}</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => onFile(null)} disabled={disabled} aria-label={tx(t('Убрать файл', 'Remove file'))}>
          <X />
        </Button>
      </div>

      {url &&
        (isVideo ? (
          <video src={url} controls className="max-h-56 w-full rounded-md bg-black" />
        ) : (
          <audio src={url} controls className="w-full" />
        ))}

      <div className="grid gap-2">
        <Label htmlFor="prepare">{tx(t('Подготовка файла', 'File preparation'))}</Label>
        <NativeSelect
          id="prepare"
          value={prepare}
          disabled={disabled}
          onChange={(e) => onPrepare(e.target.value as PrepareMode)}
        >
          <option value="mp3">
            {tx(t('Сжать в MP3 16 кГц моно — рекомендуется (≈0,35 МБ/мин, авто-нарезка)', 'Compress to MP3 16 kHz mono — recommended (≈0.35 MB/min, auto-split)'))}
          </option>
          <option value="wav">{tx(t('WAV 16 кГц моно — без потерь (≈1,9 МБ/мин, авто-нарезка)', 'WAV 16 kHz mono — lossless (≈1.9 MB/min, auto-split)'))}</option>
          <option value="original">{tx(t('Отправить как есть (без обработки)', 'Send as is (no processing)'))}</option>
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {tx(
            t(
              'Обработка идёт прямо в браузере — файл никуда не загружается, кроме выбранного сервиса. Длинные записи автоматически режутся на части под лимит сервиса и склеиваются обратно с правильными таймкодами.',
              'Processing happens right in your browser — the file is uploaded only to the service you choose. Long recordings are split to fit the service limit and stitched back together with correct timestamps.',
            ),
          )}
        </p>
      </div>
    </div>
  )
}
