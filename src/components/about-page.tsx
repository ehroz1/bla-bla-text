import { ExternalLink } from 'lucide-react'
import { LangMeter } from '@/components/lang-meter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { providers } from '@/providers'

const PUBLIC_APIS: { name: string; url: string; cors: string; note: string }[] = [
  { name: 'Groq', url: 'https://console.groq.com/docs/speech-to-text', cors: 'Yes', note: 'Whisper large-v3 — уже подключён. Его же LLM можно звать для пунктуации, резюме и перевода.' },
  { name: 'Google Gemini', url: 'https://ai.google.dev/gemini-api/docs/audio', cors: 'Unknown', note: 'Уже подключён. Одним запросом даёт расшифровку, спикеров, перевод и краткое содержание.' },
  { name: 'Hugging Face', url: 'https://huggingface.co/docs/inference-providers', cors: 'Yes', note: 'Whisper через Inference Providers — не подключали: бесплатных кредитов больше нет. Полезен NLLB-перевод (есть казахский) и суммаризаторы.' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/docs/quick-start', cors: 'Yes', note: 'Один ключ на 300+ LLM — для постобработки текста (пунктуация, саммари, перевод).' },
  { name: 'Cohere (Aya)', url: 'https://docs.cohere.com/reference/about', cors: 'Yes', note: 'Многоязычная модель Aya: хороший русский, бесплатный trial — саммари и перевод расшифровок.' },
  { name: 'NLP Cloud', url: 'https://nlpcloud.io', cors: 'Unknown', note: 'NLLB-200 перевод (включая kaz_Cyrl), определение языка, исправление грамматики.' },
  { name: 'Langbly / Kiprio', url: 'https://langbly.com/docs', cors: 'Yes', note: 'Перевод и определение языка прямо из браузера.' },
  { name: 'Detect Language', url: 'https://detectlanguage.com/', cors: 'Unknown', note: 'Определение языка по фразам: пометить, где RU, EN или KZ.' },
  { name: 'Wiktionary', url: 'https://ru.wiktionary.org/w/api.php', cors: 'Yes', note: 'Без ключа: проверка подозрительных слов (есть ru, en, kk разделы).' },
  { name: 'TranscriptYT', url: 'https://transcript-yt.com/docs', cors: 'Yes', note: 'Идея: вставить ссылку YouTube и взять готовые субтитры вместо распознавания.' },
  { name: 'CloudConvert', url: 'https://cloudconvert.com/api/v2', cors: 'Unknown', note: 'Извлечение аудио и экспорт в DOCX/PDF, если браузер не справится сам.' },
]

export function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">О проекте</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          BLA-БЛА — статическая страница без сервера. Файл обрабатывается в браузере (извлечение звука, сжатие, нарезка), затем
          отправляется напрямую в выбранный сервис с вашим ключом. Ключи, история и счётчики лежат только в localStorage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сравнение сервисов</CardTitle>
          <CardDescription>Качество — субъективная оценка по документации и публичным бенчмаркам. Точки: ●●● отлично, ●● хорошо, ● слабо.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Сервис</th>
                <th className="py-2 pr-3 font-medium">Языки</th>
                <th className="py-2 pr-3 font-medium">Бесплатно</th>
                <th className="py-2 pr-3 font-medium">Карта</th>
                <th className="py-2 pr-3 font-medium">Макс. файл</th>
                <th className="py-2 font-medium">Из браузера</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.vendor}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <LangMeter provider={p} />
                  </td>
                  <td className="py-2.5 pr-3">{p.free}</td>
                  <td className="py-2.5 pr-3">{p.card}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{Math.round(p.maxBytes / 1024 ** 2)} МБ</td>
                  <td className="py-2.5">
                    {p.cors === 'yes' ? <Badge variant="success">да</Badge> : p.cors === 'no' ? <Badge variant="warning">через прокси</Badge> : <Badge variant="outline">не проверено</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Находки из public-apis/public-apis</CardTitle>
          <CardDescription>
            Каталог из ~2000 бесплатных API. В каждой таблице есть колонки Auth / HTTPS / CORS — CORS особенно полезна для
            браузерных приложений вроде этого. Специализированного распознавания речи там почти нет (нет Deepgram, AssemblyAI,
            ElevenLabs, Yandex), зато есть полезное для постобработки текста.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {PUBLIC_APIS.map((a) => (
            <a
              key={a.name}
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group rounded-lg border p-3 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{a.name}</span>
                <span className="flex items-center gap-1.5">
                  <Badge variant={a.cors === 'Yes' ? 'success' : 'outline'}>CORS: {a.cors}</Badge>
                  <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.note}</p>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
