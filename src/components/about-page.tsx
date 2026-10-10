import { ExternalLink } from 'lucide-react'
import { LangMeter } from '@/components/lang-meter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { type L, t, tx } from '@/lib/i18n'
import { providers } from '@/providers'
import { CARD_TEXT } from '@/providers/langs'

const PUBLIC_APIS: { name: string; url: string; cors: string; note: L }[] = [
  {
    name: 'Groq',
    url: 'https://console.groq.com/docs/speech-to-text',
    cors: 'Yes',
    note: t(
      'Whisper large-v3 — уже подключён. Его же LLM можно звать для пунктуации, резюме и перевода.',
      'Whisper large-v3 is already integrated. Its LLMs can also handle punctuation, summaries and translation.',
    ),
  },
  {
    name: 'Google Gemini',
    url: 'https://ai.google.dev/gemini-api/docs/audio',
    cors: 'Unknown',
    note: t(
      'Уже подключён. Одним запросом даёт расшифровку, спикеров, перевод и краткое содержание.',
      'Already integrated. One request can return the transcript, speakers, a translation and a summary.',
    ),
  },
  {
    name: 'Hugging Face',
    url: 'https://huggingface.co/docs/inference-providers',
    cors: 'Yes',
    note: t(
      'Whisper через Inference Providers — не подключали: бесплатных кредитов больше нет. Полезен NLLB-перевод (есть казахский) и суммаризаторы.',
      'Whisper via Inference Providers — not integrated: there are no free credits anymore. Useful for NLLB translation (includes Kazakh) and summarizers.',
    ),
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/docs/quick-start',
    cors: 'Yes',
    note: t(
      'Один ключ на 300+ LLM — для постобработки текста (пунктуация, саммари, перевод).',
      'One key for 300+ LLMs — for post-processing text (punctuation, summaries, translation).',
    ),
  },
  {
    name: 'Cohere (Aya)',
    url: 'https://docs.cohere.com/reference/about',
    cors: 'Yes',
    note: t(
      'Многоязычная модель Aya: хороший русский, бесплатный trial — саммари и перевод расшифровок.',
      'The multilingual Aya model: good Russian, a free trial — summaries and translation of transcripts.',
    ),
  },
  {
    name: 'NLP Cloud',
    url: 'https://nlpcloud.io',
    cors: 'Unknown',
    note: t(
      'NLLB-200 перевод (включая kaz_Cyrl), определение языка, исправление грамматики.',
      'NLLB-200 translation (including kaz_Cyrl), language detection, grammar correction.',
    ),
  },
  {
    name: 'Langbly / Kiprio',
    url: 'https://langbly.com/docs',
    cors: 'Yes',
    note: t('Перевод и определение языка прямо из браузера.', 'Translation and language detection straight from the browser.'),
  },
  {
    name: 'Detect Language',
    url: 'https://detectlanguage.com/',
    cors: 'Unknown',
    note: t('Определение языка по фразам: пометить, где RU, EN или KZ.', 'Per-phrase language detection: mark where RU, EN or KZ is spoken.'),
  },
  {
    name: 'Wiktionary',
    url: 'https://ru.wiktionary.org/w/api.php',
    cors: 'Yes',
    note: t(
      'Без ключа: проверка подозрительных слов (есть ru, en, kk разделы).',
      'No key needed: check suspicious words (has ru, en and kk editions).',
    ),
  },
  {
    name: 'TranscriptYT',
    url: 'https://transcript-yt.com/docs',
    cors: 'Yes',
    note: t(
      'Идея: вставить ссылку YouTube и взять готовые субтитры вместо распознавания.',
      'Idea: paste a YouTube link and use its existing captions instead of transcribing.',
    ),
  },
  {
    name: 'CloudConvert',
    url: 'https://cloudconvert.com/api/v2',
    cors: 'Unknown',
    note: t(
      'Извлечение аудио и экспорт в DOCX/PDF, если браузер не справится сам.',
      'Audio extraction and DOCX/PDF export when the browser cannot do it itself.',
    ),
  },
]

export function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{tx(t('О проекте', 'About'))}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {tx(
            t(
              'BLA-БЛА — статическая страница без сервера. Файл обрабатывается в браузере (извлечение звука, сжатие, нарезка), затем отправляется напрямую в выбранный сервис с вашим ключом. Ключи, история и счётчики лежат только в localStorage.',
              'BLA-БЛА is a static page with no server. The file is processed in your browser (audio extraction, compression, splitting) and then sent directly to the service you choose, with your key. Keys, history and counters live only in localStorage.',
            ),
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tx(t('Сравнение сервисов', 'Service comparison'))}</CardTitle>
          <CardDescription>
            {tx(
              t(
                'Качество — субъективная оценка по документации и публичным бенчмаркам. Точки: ●●● отлично, ●● хорошо, ● слабо.',
                'Quality is an editorial estimate based on documentation and public benchmarks. Dots: ●●● excellent, ●● good, ● weak.',
              ),
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{tx(t('Сервис', 'Service'))}</th>
                <th className="py-2 pr-3 font-medium">{tx(t('Языки', 'Languages'))}</th>
                <th className="py-2 pr-3 font-medium">{tx(t('Бесплатно', 'Free'))}</th>
                <th className="py-2 pr-3 font-medium">{tx(t('Карта', 'Card'))}</th>
                <th className="py-2 pr-3 font-medium">{tx(t('Макс. файл', 'Max file'))}</th>
                <th className="py-2 font-medium">{tx(t('Из браузера', 'From browser'))}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{tx(p.vendor)}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <LangMeter provider={p} />
                  </td>
                  <td className="py-2.5 pr-3">{tx(p.free)}</td>
                  <td className="py-2.5 pr-3">{tx(CARD_TEXT[p.card])}</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {Math.round(p.maxBytes / 1024 ** 2)} {tx(t('МБ', 'MB'))}
                  </td>
                  <td className="py-2.5">
                    {p.cors === 'yes' ? (
                      <Badge variant="success">{tx(t('да', 'yes'))}</Badge>
                    ) : p.cors === 'no' ? (
                      <Badge variant="warning">{tx(t('через прокси', 'via proxy'))}</Badge>
                    ) : (
                      <Badge variant="outline">{tx(t('не проверено', 'not verified'))}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tx(t('Находки из public-apis/public-apis', 'Finds from public-apis/public-apis'))}</CardTitle>
          <CardDescription>
            {tx(
              t(
                'Каталог из ~2000 бесплатных API. В каждой таблице есть колонки Auth / HTTPS / CORS — CORS особенно полезна для браузерных приложений вроде этого. Специализированного распознавания речи там почти нет (нет Deepgram, AssemblyAI, ElevenLabs, Yandex), зато есть полезное для постобработки текста.',
                'A catalog of ~2,000 free APIs. Every table has Auth / HTTPS / CORS columns — CORS is especially useful for browser apps like this one. There is almost no dedicated speech recognition there (no Deepgram, AssemblyAI, ElevenLabs, Yandex), but there is plenty for post-processing text.',
              ),
            )}
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
              <p className="mt-1 text-sm text-muted-foreground">{tx(a.note)}</p>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
